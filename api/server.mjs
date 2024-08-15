import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import session from 'express-session';
import { createProxyMiddleware } from 'http-proxy-middleware';

// Construct __dirname equivalent in ES module scope
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
//dotenv.config();

const app = express();

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Middleware to add Authorization header
const authMiddleware = (req, res, next) => {
  // not ideal but if someone wanted to use hardcoded token on the backend
  if (!req.session.token && !process.env.VUE_APP_GITHUB_TOKEN) {
    res.status(401).send('Unauthorized');
    return;
  }

  if (process.env.VUE_APP_GITHUB_TOKEN) {
    // Use the hardcoded token if it's available
    req.session.token = process.env.VUE_APP_GITHUB_TOKEN;
  }

  req.headers['Authorization'] = `Bearer ${req.session.token}`;
  console.log('Added Authorization to:', req.url);
  next();
};

const githubProxy = createProxyMiddleware({
  target: 'https://api.github.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api/github': '', // Rewrite URL path (remove /api/github)
  },
  onProxyReq: (proxyReq, req) => {
    console.log('Proxying request to GitHub API:', req.url);
    // Optional: Modify the proxy request here (e.g., headers)
  },
});

app.get('/assets/app-config.js', (req, res) => {
  // get the token from the session
  const org = req.session.org || process.env.VUE_APP_GITHUB_ORG || '';
  const ent = process.env.VUE_APP_GITHUB_ENT || '';
  const scope = process.env.VUE_APP_SCOPE;

  if (req.session.org) {
    const response = `
    // this is my file
    window._ENV_ = {
    VUE_APP_MOCKED_DATA: "",
    VUE_APP_SCOPE: "${scope}",
    VUE_APP_GITHUB_ORG: "${org}",
    VUE_APP_GITHUB_ENT: "${ent}",
    VUE_APP_GITHUB_TOKEN: "",
    VUE_APP_GITHUB_API: "/api/github",
  };`;
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-store');
    res.send(response);
  } else {
    // send the file
    res.sendFile(path.join(__dirname, 'public', 'assets', 'app-config.js'));
  }

});

// Apply middlewares to the app
app.use('/api/github', authMiddleware, githubProxy);

const exchangeCode = async (code) => {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    client_secret: process.env.GITHUB_CLIENT_SECRET,
    code: code,
  });

  try {
    const response = await axios.post('https://github.com/login/oauth/access_token', params, {
      headers: { 'Accept': 'application/json' }
    });

    if (response.status === 200) {
      return response.data;
    } else {
      console.log(response);
      return {};
    }
  } catch (error) {
    console.error('Error in exchangeCode:', error);
    return {};
  }
};

// Serve static files from the Vue app
app.use(express.static(path.join(__dirname, 'public')));

app.get('/login', (req, res) => {
  // build the URL to redirect to GitHub using host and scheme
  const redirectUrl = `${req.protocol}://${req.get('host')}/callback`;
  // generate random state
  // store the state in the session
  req.session.state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  res.redirect(`https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${redirectUrl}&state=${req.session.state}`);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  // check the state against the session
  if (state !== req.session.state) {
    res.send('Invalid state');
    return;
  }

  const tokenData = await exchangeCode(code);

  if (tokenData.access_token) {
    const token = tokenData.access_token;

    // Store the token in the session
    req.session.token = token;

    if (!process.env.VUE_APP_GITHUB_ORG) {
      // here when if we don't have the org - we take it from the user's orgs

      const orgsResponse = await axios.get('https://api.github.com/user/orgs', {
        headers: {
          Authorization: `token ${token}`
        }
      });

      const organizations = orgsResponse.data;
      if (organizations.length > 0) {
        const org = organizations[0].login; // Use the first organization login name
        req.session.org = org;
      } else {
        res.send('No organizations found - Install the app on an organization');
        return;
      }
    }

    // redirect to the Vue app with the user's information
    res.redirect(`/`);
  } else {
    res.send(`Authorized, but unable to exchange code ${code} for token.`);
  }
});

// All other requests to serve the Vue app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

process.on('SIGINT', () => {
  console.log('Received SIGINT. Exiting...');
  // Clean up your application's resources here
  process.exit(0);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));