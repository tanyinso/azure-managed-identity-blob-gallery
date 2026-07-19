require('dotenv').config();

const express = require('express');
const multer = require('multer');
const { DefaultAzureCredential } = require('@azure/identity');
const { BlobServiceClient } = require('@azure/storage-blob');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Accepts either a bare account name ("stmilabbright123")
// or a full blob endpoint URL ("https://stmilabbright123.blob.core.windows.net")
function resolveAccountUrl(value) {
  if (!value) return null;
  return value.startsWith('http')
    ? value.replace(/\/+$/, '')
    : `https://${value}.blob.core.windows.net`;
}

// Accepts either a bare container name ("lab-data")
// or a full blob URL ("https://.../lab-data")
function resolveContainerName(value) {
  if (!value) return 'gallery';
  if (value.startsWith('http')) {
    const parts = value.replace(/\/+$/, '').split('/');
    return parts[parts.length - 1];
  }
  return value;
}

const accountUrl = resolveAccountUrl(process.env.STORAGE_ACCOUNT);
const container = resolveContainerName(process.env.CONTAINER_NAME);
const port = process.env.PORT || 3000;

if (!accountUrl) {
  console.error('Missing STORAGE_ACCOUNT in .env — set it to your account name or full blob endpoint URL.');
  process.exit(1);
}

const svc = new BlobServiceClient(accountUrl, new DefaultAzureCredential());

app.get('/', async (req, res) => {
  try {
    const cc = svc.getContainerClient(container);
    const imgs = [];
    for await (const b of cc.listBlobsFlat()) imgs.push(b.name);
    res.render('index', { imgs });
  } catch (err) {
    console.error('Failed to list blobs:', err.message);
    res.status(500).send('Could not load gallery — check the server console.');
  }
});

app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const cc = svc.getContainerClient(container);
    await cc.getBlockBlobClient(req.file.originalname).uploadData(req.file.buffer);
    console.log(`Uploaded: ${req.file.originalname}`);
    res.redirect('/');
  } catch (err) {
    console.error('Upload failed:', err.message);
    res.status(500).send('Upload failed — check the server console.');
  }
});

app.get('/image/:name', async (req, res) => {
  try {
    const dl = await svc.getContainerClient(container).getBlobClient(req.params.name).download();
    res.setHeader('Content-Type', dl.contentType || 'application/octet-stream');
    dl.readableStreamBody.pipe(res);
  } catch (err) {
    console.error(`Failed to fetch image "${req.params.name}":`, err.message);
    res.status(404).send('Image not found.');
  }
});

app.post('/delete/:name', async (req, res) => {
  try {
    await svc.getContainerClient(container).deleteBlob(req.params.name);
    console.log(`Deleted: ${req.params.name}`);
    res.redirect('/');
  } catch (err) {
    console.error(`Failed to delete "${req.params.name}":`, err.message);
    res.status(500).send('Delete failed — check the server console.');
  }
});

app.listen(port, () => {
  console.log('');
  console.log('Blob Gallery server is running');
  console.log(`  URL:              http://localhost:${port}`);
  console.log(`  Storage account:  ${accountUrl}`);
  console.log(`  Container:        ${container}`);
  console.log('');
});
