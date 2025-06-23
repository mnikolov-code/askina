const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

mongoose.connect('mongodb://localhost:27017/askinaPlatform', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.once('open', () => console.log('MongoDB connected'));

const Admin = mongoose.model('Admin', { username: String, password: String, email: String });
const Application = mongoose.model('Application', { name: String, email: String, message: String });

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({ secret: 'secret-key', resave: false, saveUninitialized: true }));
app.use(express.static(__dirname));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await Admin.findOne({ username, password });
  if (user) {
    req.session.user = user.username;
    req.session.role = user.username === 'admin' ? 'admin' : 'user';
    res.redirect('/');
  } else {
    res.status(401).send('Login failed.');
  }
});

app.post('/register', async (req, res) => {
  const { username } = req.body;
  const exists = await Admin.findOne({ username });
  if (exists) return res.status(400).send('Username exists!');
  await Admin.create(req.body);
  res.redirect('/');
});

const SectionContent = mongoose.model('SectionContent', { sectionId: String, content: String });

app.post('/admin/save-section', async (req, res) => {
  if (!req.session.user || req.session.role !== 'admin') return res.status(401).send('Unauthorized');
  const { sectionId, content } = req.body;
  await SectionContent.findOneAndUpdate(
    { sectionId },
    { content },
    { upsert: true, new: true }
  );
  res.send('Section content saved!');
});

app.get('/admin/section/:id', async (req, res) => {
  const section = await SectionContent.findOne({ sectionId: req.params.id });
  res.json({ content: section?.content || '' });
});

app.post('/api/apply', async (req, res) => {
  await Application.create(req.body);
  res.send('Submitted!');
});

app.get('/session-status', (req, res) => {
  res.json({ loggedIn: !!req.session.user, username: req.session.user, role: req.session.role });
});

app.get('/admin/applications', async (req, res) => {
  if (!req.session.user || req.session.role !== 'admin') return res.status(401).send('Unauthorized');
  const apps = await Application.find({});
  res.json(apps);
});
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Logout failed');
    }
    res.redirect('/');
  });
});
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(8080, () => console.log('Server running at http://localhost:8080'));
