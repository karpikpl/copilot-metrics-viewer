import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import appInsights from 'applicationinsights';
import { createProxyMiddleware } from 'http-proxy-middleware';
import github from './github.mjs';

appInsights.setup().start();
const gh = new github();
gh.hello();

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
const authMiddleware = async (req, res, next) => {
  // not ideal but if someone wanted to use hardcoded token on the backend
  if (!req.session.token && !process.env.VUE_APP_GITHUB_TOKEN) {
    res.status(401).send('Unauthorized');
    return;
  }

  if (process.env.VUE_APP_GITHUB_TOKEN) {
    // Use the hardcoded token if it's available
    req.session.token = { access_token: process.env.VUE_APP_GITHUB_TOKEN };
  }

  const oneMinute = 60 * 1000; // 1 minute in milliseconds
  if (req.session.expires && Date.now() > req.session.expires - oneMinute) {
    // Token is expiring
    console.log('Token has expired - refreshing');
    const tokenData = await gh.refreshToken(req.session.token.refresh_token);
    req.session.token = tokenData;
  }

  req.headers['Authorization'] = `Bearer ${req.session.token.access_token}`;
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

if (process.env.PUBLIC_APP) {

  // this modifies the app-config.js file to include the org and orgs
  app.get('/assets/app-config.js', (req, res) => {
    // get the token from the session
    const org = req.session.org || ''
    const orgs = req.session.orgs || ''

    const response = `
    // this is my file
    window._ENV_ = {
    VUE_APP_MOCKED_DATA: "",
    VUE_APP_SCOPE: "organization",
    VUE_APP_GITHUB_ORG: "${org}",
    VUE_APP_GITHUB_ENT: "",
    VUE_APP_GITHUB_TOKEN: "",
    VUE_APP_GITHUB_API: "/api/github",
    VUE_APP_GITHUB_ORGS: "${orgs}",
    VUE_APP_GITHUB_TEAM: "${process.env.VUE_APP_GITHUB_TEAM || ''}",
  };`;

    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-store');
    res.send(response);
  });
}

// Apply middlewares to the app
app.use('/api/github', authMiddleware, githubProxy);

// Serve static files from the Vue app
app.use(express.static(path.join(__dirname, 'public')));

app.get('/login', (req, res) => {
  // build the URL to redirect to GitHub using host and scheme
  req.session.state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const redirectUrl = gh.buildRedirectUrl(req.get('host'), req.hostname, req.session.state);
  res.redirect(redirectUrl);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;
  const error = req.query.error;
  const errorDescription = req.query.error_description;
  const installationId = req.query.installation_id;
  const setupAction = req.query.setup_action;

  if (error) {
    res.send(`Error: ${error} - ${errorDescription}`);
    return;
  }

  if (installationId && setupAction == 'install') {
    console.log(`Redirecting to home after installation ${installationId}`);
    res.redirect(`/login`);
    return;
  }

  // check the state against the session
  if (state !== req.session.state) {
    res.send('Invalid state');
    return;
  }

  const tokenData = await gh.exchangeCodeForToken(code);

  if (tokenData.access_token) {
    const token = tokenData.access_token;

    // Store the token in the session
    req.session.token = tokenData;
    req.session.expires = Date.now() + tokenData.expires_in * 1000;

    // only for public app deployments serving many orgs
    if (process.env.PUBLIC_APP) {
      // here when if we don't have the org - we take it from the user's orgs

      const organizations = await gh.getOrgs(token);
      let org;

      if (organizations.length > 0) {
        org = organizations[0]; // Use the first organization login name
        req.session.org = org;
        req.session.orgs = organizations.join(',');
      } else {

        // if the user is not part of any orgs, redirect to the app's GitHub page so they can install it
        res.redirect(`https://github.com/apps/copilot-metrics-viewer`);
        return;
      }

      const teams = await gh.getTeams(token, org);
      req.session.teams = teams.join(',');
    }

    // redirect to the Vue app with the user's information
    res.redirect(`/`);
  } else {
    const error = tokenData.error;
    const errorDescription = tokenData.error_description;
    res.send(`Error: ${error} - ${errorDescription}`);
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
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