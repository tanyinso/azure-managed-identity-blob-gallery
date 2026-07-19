
const express=require('express');
const multer=require('multer');
const {DefaultAzureCredential}=require('@azure/identity');
const {BlobServiceClient}=require('@azure/storage-blob');
const app=express(),upload=multer({storage:multer.memoryStorage()});
app.set('view engine','ejs');app.use(express.static('public'));
const account=process.env.STORAGE_ACCOUNT;
const container=process.env.CONTAINER_NAME||'gallery';
const svc=new BlobServiceClient(`https://${account}.blob.core.windows.net`,new DefaultAzureCredential());


app.get('/',async(req,res)=>{
 const cc=svc.getContainerClient(container);let imgs=[];
 for await(const b of cc.listBlobsFlat()) imgs.push(b.name);
 res.render('index',{imgs});
});
app.post('/upload',upload.single('image'),async(req,res)=>{
 const cc=svc.getContainerClient(container);
 await cc.getBlockBlobClient(req.file.originalname).uploadData(req.file.buffer);
 res.redirect('/');
});
app.get('/image/:name',async(req,res)=>{
 const dl=await svc.getContainerClient(container).getBlobClient(req.params.name).download();
 res.setHeader('Content-Type',dl.contentType||'application/octet-stream');
 dl.readableStreamBody.pipe(res);
});
app.post('/delete/:name',async(req,res)=>{
 await svc.getContainerClient(container).deleteBlob(req.params.name);
 res.redirect('/');
});
app.listen(process.env.PORT||3000,()=>{
    console.log(`serving on http://localhost:${PORT}`)
})