const express = require('express');
const multer = require('multer');
const { DefaultAzureCredential } = require('@azure/identity');
const { BlobServiceClient } = require('@azure/storage-blob');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Hardcoded directly — no .env, no App Service app settings needed.
// Neither of these is a secret, so this is safe: managed identity means
// there's no key or password to protect in the first place.
const STORAGE_ACCOUNT = 'stmilabbright123';
const CONTAINER_NAME = 'lab-data';

const accountUrl = `https://${STORAGE_ACCOUNT}.blob.core.windows.net`;
const container = CONTAINER_NAME;

// PORT is the one exception — this must stay dynamic. Azure App Service
// assigns its own port at runtime and injects it via process.env.PORT;
// hardcoding this would break the deployment.
const port = process.env.PORT || 3000;

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