
    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    const panelLogin = document.getElementById('panel-login');
    const panelSignup = document.getElementById('panel-signup');
    
    function showLogin(){ 
      tabLogin.classList.add('active'); 
      tabSignup.classList.remove('active'); 
      panelLogin.style.display='block'; 
      panelSignup.style.display='none'; 
    }
    
    function showSignup(){ 
      tabSignup.classList.add('active'); 
      tabLogin.classList.remove('active'); 
      panelSignup.style.display='block'; 
      panelLogin.style.display='none'; 
    }
    
    tabLogin.addEventListener('click', showLogin);
    tabSignup.addEventListener('click', showSignup);
    document.getElementById('footer-switch').addEventListener('click',(e)=>{e.preventDefault(); showLogin();});

    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const backendURL = isLocal ? 'http://localhost:4000' : 'https://newonwheels.onrender.com';

    // Login form handler
    document.getElementById('login-form').addEventListener('submit', async (e)=>{
      e.preventDefault();
      const identifier = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-pass').value;
      
      if (!identifier || !password) {
        alert('Please enter email/phone and password');
        return;
      }

      try {
        const res = await fetch(backendURL + '/api/login', {
          method:'POST',
          headers:{'Content-Type':'application/json'}, 
          body: JSON.stringify({identifier, password})
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          alert('Login failed: ' + (data.error || 'Unknown error'));
          console.error('Login error:', data);
          return;
        }

        // Store token and user info in localStorage
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        alert('✅ Logged in successfully! Welcome, ' + data.user.name);
        console.log('Login successful:', data);
        
        // Clear form
        document.getElementById('login-form').reset();
      } catch (err) {
        console.error('Login request error:', err);
        alert('Network error: Unable to connect to backend');
      }
    });

    // Signup form handler
    document.getElementById('signup-form').addEventListener('submit', async (e)=>{
      e.preventDefault();
      
      const name = document.getElementById('signup-name').value.trim();
      const phone = document.getElementById('signup-phone').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-pass').value;

      if (!name || !password || (!phone && !email)) {
        alert('Please fill in all required fields (name, password, and either phone or email)');
        return;
      }

      try {
        const res = await fetch(backendURL + '/api/signup', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({name, phone, email, password})
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          alert('Signup failed: ' + (data.error || 'Unknown error'));
          console.error('Signup error:', data);
          return;
        }

        // Store token and user info in localStorage
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        alert('✅ Account created successfully! Welcome, ' + data.user.name);
        console.log('Signup successful:', data);
        
        // Reset form
        document.getElementById('signup-form').reset();
      } catch (err) {
        console.error('Signup request error:', err);
        alert('Network error: Unable to connect to backend');
      }
    });
  