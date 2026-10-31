const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

function createAdminMechanicHandlers(User) {
    async function approve(req, res) {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid mechanic ID' });
        }
        if (typeof req.body?.isApproved !== 'boolean') {
            return res.status(400).json({ error: 'Approval status must be true or false' });
        }
        try {
            const isApproved = req.body.isApproved;
            const update = {
                $set: isApproved ? { isApproved } : { isApproved, isAvailable: false, isOnline: false },
                $inc: { sessionVersion: 1 }
            };
            const mechanic = await User.findByIdAndUpdate(req.params.id, update, { new: true });
            if (!mechanic) return res.status(404).json({ error: 'Mechanic not found' });
            return res.json({ ok: true, message: isApproved ? 'Mechanic verified.' : 'Mechanic suspended.', isApproved: mechanic.isApproved });
        } catch (error) {
            console.error('Admin mechanic approval failed:', error);
            return res.status(500).json({ error: 'Could not update mechanic verification' });
        }
    }

    async function setPassword(req, res) {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid mechanic ID' });
        }
        const password = req.body?.newPassword;
        if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
            return res.status(400).json({ error: 'Password must be at least 8 characters and at most 72 bytes' });
        }
        try {
            if (!await User.exists({ _id: req.params.id })) return res.status(404).json({ error: 'Mechanic not found' });
            const passwordHash = await bcrypt.hash(password, 12);
            const mechanic = await User.findByIdAndUpdate(req.params.id, {
                $set: { password: passwordHash },
                $unset: { passwordResetHash: 1, passwordResetExpires: 1, passwordResetRequestedAt: 1 },
                $inc: { sessionVersion: 1 }
            });
            if (!mechanic) return res.status(404).json({ error: 'Mechanic not found' });
            return res.json({ ok: true, message: 'Password updated. Mechanic must log in again.' });
        } catch (error) {
            console.error('Admin mechanic password update failed:', error);
            return res.status(500).json({ error: 'Could not update mechanic password' });
        }
    }

    return { approve, setPassword };
}

module.exports = { createAdminMechanicHandlers };
