const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');
const app = express();
const Job = mongoose.model('Job', {
  title: String,
  company: String,
  type: String,
  location: String,
  description: String,
  contact: String,
  phone: String, // ✅ додадено
  createdAt: { type: Date, default: Date.now }
});


const multer = require('multer');
const nodemailer = require('nodemailer');

const upload = multer({ dest: 'uploads/' }); // Фолдерот каде ќе се чуваат привремено

app.post('/api/apply-job', upload.single('cv'), async (req, res) => {
  const { name, email, message, jobTitle } = req.body;
  const cv = req.file;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'askina.org@gmail.com',
      pass: 'gsbt qtif vqxh yjfk'
    }
  });

  const mailOptions = {
    from: 'ASKINA <your-gmail@gmail.com>',
    to: 'vlavcheto@gmail.com',
    subject: `New Application for ${jobTitle}`,
    text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
    attachments: [
      {
        filename: cv.originalname,
        path: cv.path
      }
    ]
  };

  try {
    await transporter.sendMail(mailOptions);
    res.send(`
  <html>
    <head>
      <meta charset="UTF-8">
      <title>Application Sent</title>
      <meta http-equiv="refresh" content="10;url=/" />
      <style>
        body {
          font-family: 'Segoe UI', sans-serif;
          text-align: center;
          margin-top: 100px;
          color: #b02a37;
        }
      </style>
    </head>
    <body>
      <h1>✅ Application Sent!</h1>
      <p>Thank you for applying. You will be redirected to the home page in <strong>10 seconds</strong>.</p>
      <p>If not redirected, <a href="/">click here</a>.</p>
    </body>
  </html>
`);

  } catch (err) {
    console.error(err);
    res.status(500).send('Error sending email');
  }
});


mongoose.connect('mongodb://localhost:27017/askinaPlatform');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({ secret: 'secret-key', resave: false, saveUninitialized: true }));
app.use(express.static(__dirname));
app.post('/api/jobs', async (req, res) => {
  console.log('Received job from client:', req.body);
  if (!req.body.title) {
    return res.status(400).send('Missing job data!');
  }
  await Job.create(req.body);
  res.send('Job saved!');
});

app.get('/api/jobs', async (req, res) => {
  const jobs = await Job.find({}).sort({ createdAt: -1 });
  res.json(jobs);
});


mongoose.connection.once('open', () => console.log('MongoDB connected'));

const Admin = mongoose.model('Admin', { username: String, password: String, email: String });
const Application = mongoose.model('Application', { name: String, email: String, message: String });



app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await Admin.findOne({ username, password });
  if (user) {
    req.session.user = user.username;
    req.session.role = user.username === 'admin' ? 'admin' : 'user';
    res.json({ success: true }); // 🔁 Враќа JSON
  } else {
    res.status(401).json({ success: false, message: 'Login failed' });
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

const PDFDocument = require('pdfkit');
const { Readable } = require('stream');

// 🚀 Donation endpoint
app.post('/api/donate', async (req, res) => {
  const { amount, name, email } = req.body;
  const invoiceNo = 'INV-' + Date.now();
  const dateStr = new Date().toLocaleDateString('en-US');

  // Generate PDF in memory
  const doc = new PDFDocument();
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', async () => {
    const pdfBuffer = Buffer.concat(chunks);

    // Send email with PDF attachment
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'askina.org@gmail.com',
        pass: 'gsbt qtif vqxh yjfk' // App password
      }
    });

    const mailOptions = {
      from: 'ASKINA <askina.org@gmail.com>',
      to: email,
      bcc: 'askina.org@gmail.com',
      subject: 'Donation Invoice – ASKINA',
      text: `Dear ${name},\n\nThank you for your donation!\nYour invoice is attached.\n\nBest,\nASKINA`,
      attachments: [{
        filename: `${invoiceNo}.pdf`,
        content: pdfBuffer
      }]
    };

    try {
      await transporter.sendMail(mailOptions);
      res.status(200).send('Invoice sent!');
    } catch (err) {
      console.error('Email send error:', err);
      res.status(500).send('Failed to send invoice');
    }
  });

  // Write PDF content
  doc.fontSize(20).text('INVOICE – ASKINA', { align: 'center' }).moveDown();
  doc.fontSize(12).text(`Invoice Number: ${invoiceNo}`);
  doc.text(`Date: ${dateStr}`);
  doc.text(`Donor Name: ${name}`);
  doc.text(`Email: ${email}`);
  doc.text(`Amount (USD): $${amount}`).moveDown();
  doc.font('Helvetica-Bold').text('Payoneer Transfer Details:');
  doc.font('Helvetica').text(`Bank: First Century Bank`);
  doc.text(`Routing: 061120084`);
  doc.text(`Account: 123456789`);
  doc.text(`Type: Checking`);
  doc.text(`Beneficiary: Martin Nikolov (ASKINA)`);
  doc.text(`Include invoice number as reference`);
  doc.moveDown();
  doc.text(`You may also donate via card: https://your-payment-link.com`);
  doc.moveDown();
  doc.fontSize(10).text('This invoice was generated automatically. No signature is required.');
  doc.end();
});


app.listen(8080, () => console.log('Server running at http://localhost:8080'));
