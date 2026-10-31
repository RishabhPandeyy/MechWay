const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const MESSAGE = 'If this account has a registered email, a 6-digit OTP will be sent. Please check your inbox and spam folder.';
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
const sessionMatches = (claims, user) => Boolean(user) && (claims.sessionVersion || 0) === (user.sessionVersion || 0);

function emailConfiguration(env = process.env) {
    const base = new URL(env.PASSWORD_RESET_BASE_URL || env.PUBLIC_BASE_URL || (env.NODE_ENV === 'production' ? 'https://www.mechway.in' : 'http://localhost:4000'));
    if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname))) {
        throw new Error('Password reset base URL must use HTTPS');
    }
    const port = Number(env.SMTP_PORT || 465);
    const configured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && [465, 587].includes(port));
    return {
        baseUrl: base.origin,
        from: env.MAIL_FROM || `MechWay <${env.SMTP_USER || 'mechwaysupport@gmail.com'}>`,
        mailer: configured ? nodemailer.createTransport({
            host: env.SMTP_HOST, port, secure: port === 465, requireTLS: port === 587,
            auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
            connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
        }) : null
    };
}

function formatPasswordHelpTelegram({ identifier, user, baseUrl }) {
    const escape = value => String(value || 'Not provided').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    return [
        '<b>Mechanic password help request</b>',
        `<b>Submitted email / phone:</b> ${escape(identifier)}`,
        `<b>Account:</b> ${user ? 'Matched' : 'No matching account found'}`,
        `<b>Name:</b> ${escape(user?.name)}`,
        `<b>Registered phone:</b> ${escape(user?.phone)}`,
        `<b>Registered email:</b> ${escape(user?.email)}`,
        `<b>Mechanic ID:</b> ${escape(user?._id)}`,
        '',
        'Confirm the requester owns this account, then set a new password in the admin panel and contact them.',
        `<a href="${escape(new URL('/server/admin.html', baseUrl).href)}">Open admin panel</a>`
    ].join('\n');
}

function createPasswordResetHandlers({ User, mailer, from, baseUrl, notifyPasswordHelp, now = Date.now, logger = console }) {
    const attempts = new Map();
    function limited(key, maximum) {
        const time = now();
        for (const [entry, value] of attempts) if (value.expires <= time) attempts.delete(entry);
        const value = attempts.get(key) || { count: 0, expires: time + 15 * 60 * 1000 };
        // Keep memory bounded even under requests with random identifiers.
        if (!attempts.has(key) && attempts.size >= 10000) return true;
        value.count += 1;
        attempts.set(key, value);
        return value.count > maximum;
    }
    function throttle(res) {
        res.set('Retry-After', '900');
        return res.status(429).json({ error: 'Too many attempts. Please try again in 15 minutes.' });
    }
    async function help(req, res) {
        res.set('Cache-Control', 'no-store');
        const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim() : '';
        const digits = identifier.replace(/\D/g, '');
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
        const isPhone = /^[+\d\s()-]+$/.test(identifier) && (digits.length === 10 || (digits.length === 12 && digits.startsWith('91')));
        if (identifier.length > 254 || (!isEmail && !isPhone)) {
            return res.status(400).json({ error: 'Enter a valid registered email or phone number.' });
        }
        if (limited(`request:${req.ip}`, 20) || limited(`account:${hashToken(isEmail ? identifier.toLowerCase() : digits.slice(-10))}`, 3)) return throttle(res);
        try {
            if (!notifyPasswordHelp) throw new Error('Password help notifications not configured');
            const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const lookup = isEmail ? { email: new RegExp(`^${escaped}$`, 'i') }
                : { phone: { $in: [...new Set([identifier, digits, digits.slice(-10), `91${digits.slice(-10)}`])] } };
            const user = await User.findOne(lookup).select('name phone email').lean();
            await notifyPasswordHelp(formatPasswordHelpTelegram({ identifier, user, baseUrl }));
            return res.json({ ok: true, message: 'Your request is submitted. Our support team will contact you as soon as possible.' });
        } catch (error) {
            logger.error('Password help request failed');
            return res.status(503).json({ error: 'Could not submit your request. Please try again shortly or contact support@mechway.in.' });
        }
    }
    async function request(req, res) {
        res.set('Cache-Control', 'no-store');
        const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim() : '';
        const digits = identifier.replace(/\D/g, '');
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
        const isPhone = /^[+\d\s()-]+$/.test(identifier) && (digits.length === 10 || (digits.length === 12 && digits.startsWith('91')));
        if (identifier.length > 254 || (!isEmail && !isPhone)) return res.status(400).json({ error: 'Enter your registered email or phone.' });
        if (limited(`request:${req.ip}`, 20) || limited(`account:${hashToken(isEmail ? identifier.toLowerCase() : digits.slice(-10))}`, 3)) return throttle(res);
        if (!mailer) return res.status(503).json({ error: 'Reset email is not available yet. Please contact mechwaysupport@gmail.com.' });
        try {
            const digits = identifier.replace(/\D/g, '');
            const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const lookup = identifier.includes('@')
                ? { email: new RegExp(`^${escaped}$`, 'i') }
                : { phone: { $in: [...new Set([identifier, digits, digits.slice(-10), digits.length === 10 ? `91${digits}` : digits])] } };
            const challenge = crypto.randomBytes(32).toString('hex');
            const otp = String(crypto.randomInt(100000, 1000000));
            const challengeHash = hashToken(challenge);
            const time = now();
            const user = await User.findOneAndUpdate({
                ...lookup, email: lookup.email || { $type: 'string', $ne: '' },
                $or: [{ passwordResetRequestedAt: { $exists: false } }, { passwordResetRequestedAt: { $lte: new Date(time - 60000) } }]
            }, { $set: {
                passwordResetOtpChallengeHash: challengeHash,
                passwordResetOtpHash: hashToken(`${challenge}:${otp}`),
                passwordResetOtpExpires: new Date(time + 10 * 60 * 1000),
                passwordResetOtpAttempts: 0,
                passwordResetRequestedAt: new Date(time)
            }, $unset: { passwordResetHash: 1, passwordResetExpires: 1 } }, { new: true });
            // Email delivery does not affect the response time or reveal whether the account exists.
            res.json({ ok: true, message: MESSAGE, challenge });
            if (!user) return;
            try {
                await mailer.sendMail({
                    from, to: user.email, subject: 'Your MechWay password reset OTP',
                    text: `Your MechWay mechanic password reset OTP is: ${otp}\n\nThis code expires in 10 minutes and can be used once. Do not share it with anyone. If you did not request this, ignore this email. Your password has not changed.\n\nMechWay Support\nmechwaysupport@gmail.com`
                });
            } catch (error) {
                await User.updateOne({ _id: user._id, passwordResetOtpChallengeHash: challengeHash }, { $unset: { passwordResetOtpChallengeHash: 1, passwordResetOtpHash: 1, passwordResetOtpExpires: 1, passwordResetOtpAttempts: 1, passwordResetRequestedAt: 1 } });
                logger.error('Password reset email delivery failed', { code: error.code || 'MAIL_ERROR' });
            }
        } catch (error) {
            logger.error('Password reset request failed');
            if (!res.headersSent) res.status(503).json({ error: 'Could not process the request. Please try again shortly.' });
        }
    }
    async function verify(req, res) {
        res.set('Cache-Control', 'no-store');
        if (limited(`verify:${req.ip}`, 30)) return throttle(res);
        const { challenge, otp } = req.body || {};
        const invalid = () => res.status(400).json({ error: 'Invalid or expired OTP. Request a new code if needed.' });
        if (typeof challenge !== 'string' || !/^[a-f0-9]{64}$/.test(challenge) || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) return invalid();
        try {
            const query = {
                passwordResetOtpChallengeHash: hashToken(challenge),
                passwordResetOtpExpires: { $gt: new Date(now()) },
                passwordResetOtpAttempts: { $lt: 5 }
            };
            // Count guesses atomically in MongoDB, including across server instances.
            const user = await User.findOneAndUpdate(query, { $inc: { passwordResetOtpAttempts: 1 } }, {
                new: true, projection: { _id: 1, passwordResetOtpHash: 1 }
            });
            const otpHash = hashToken(`${challenge}:${otp}`);
            if (!user || !user.passwordResetOtpHash || !crypto.timingSafeEqual(Buffer.from(otpHash, 'hex'), Buffer.from(user.passwordResetOtpHash, 'hex'))) return invalid();
            const token = crypto.randomBytes(32).toString('hex');
            // Consume the challenge once; only the winning verification receives a reset token.
            const verified = await User.findOneAndUpdate({
                _id: user._id, passwordResetOtpChallengeHash: hashToken(challenge),
                passwordResetOtpHash: otpHash, passwordResetOtpExpires: { $gt: new Date(now()) }
            }, {
                $set: { passwordResetHash: hashToken(token), passwordResetExpires: new Date(now() + 5 * 60 * 1000) },
                $unset: { passwordResetOtpChallengeHash: 1, passwordResetOtpHash: 1, passwordResetOtpExpires: 1, passwordResetOtpAttempts: 1 }
            }, { new: true });
            if (!verified) return invalid();
            return res.json({ ok: true, token });
        } catch (error) {
            logger.error('Password reset OTP verification failed');
            return res.status(503).json({ error: 'Could not verify OTP. Please try again shortly.' });
        }
    }
    async function reset(req, res) {
        res.set('Cache-Control', 'no-store');
        if (limited(`reset:${req.ip}`, 20)) return throttle(res);
        const { token, password } = req.body || {};
        if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ error: 'Invalid password reset verification. Please request a new OTP.' });
        if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
            return res.status(400).json({ error: 'Use at least 8 characters, up to 72 bytes, for your new password.' });
        }
        try {
            const query = { passwordResetHash: hashToken(token), passwordResetExpires: { $gt: new Date(now()) } };
            if (!await User.exists(query)) return res.status(400).json({ error: 'Password reset verification has expired or was already used. Please request a new OTP.' });
            const passwordHash = await bcrypt.hash(password, 12);
            // Atomically consume the token so simultaneous submissions cannot both succeed.
            const user = await User.findOneAndUpdate({ ...query, passwordResetExpires: { $gt: new Date(now()) } }, {
                $set: { password: passwordHash },
                $unset: { passwordResetHash: 1, passwordResetExpires: 1, passwordResetRequestedAt: 1 },
                $inc: { sessionVersion: 1 }
            }, { new: true });
            if (!user) return res.status(400).json({ error: 'Password reset verification has expired or was already used. Please request a new OTP.' });
            res.json({ ok: true, message: 'Password updated successfully. Please log in with your new password.' });
        } catch (error) {
            logger.error('Password reset failed');
            res.status(503).json({ error: 'Could not reset your password. Please try again shortly.' });
        }
    }
    return { request, reset, help, verify };
}

module.exports = { createPasswordResetHandlers, emailConfiguration, hashToken, sessionMatches };
