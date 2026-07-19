import 'dotenv/config';

import express from "express";
import multer from "multer";

import {
    DefaultAzureCredential
} from "@azure/identity";

import {
    BlobServiceClient
} from "@azure/storage-blob";


const app = express();


const upload = multer({
    storage: multer.memoryStorage()
});


app.set("view engine","ejs");

app.use(express.static("public"));



const storageAccount =
process.env.STORAGE_ACCOUNT;


const containerName =
process.env.CONTAINER_NAME;



console.log("Storage:",storageAccount);
console.log("Container:",containerName);



const credential =
new DefaultAzureCredential();



const blobServiceClient =
new BlobServiceClient(
`https://${storageAccount}.blob.core.windows.net`,
credential
);



const containerClient =
blobServiceClient.getContainerClient(containerName);





// Home page

app.get("/",async(req,res)=>{


    let images=[];


    for await(
        const blob of containerClient.listBlobsFlat()
    ){

        images.push(blob.name);

    }


    res.render("index",{
        images
    });


});





// Upload image

app.post(
"/upload",
upload.single("image"),
async(req,res)=>{


    const blobClient =
    containerClient.getBlockBlobClient(
        req.file.originalname
    );



    await blobClient.uploadData(
        req.file.buffer,
        {

            blobHTTPHeaders:{
                blobContentType:req.file.mimetype
            }

        }
    );


    res.redirect("/");

});





// Display image


app.get(
"/image/:name",
async(req,res)=>{


    const blobClient =
    containerClient.getBlobClient(
        req.params.name
    );


    const properties =
    await blobClient.getProperties();



    const download =
    await blobClient.download();



    res.setHeader(
        "Content-Type",
        properties.contentType
    );


    download.readableStreamBody.pipe(res);


});





// Delete image


app.post(
"/delete/:name",
async(req,res)=>{


    await containerClient
    .deleteBlob(req.params.name);



    res.redirect("/");


});







const PORT =
process.env.PORT || 3000;



app.listen(PORT,()=>{

console.log(
`Running on http://localhost:${PORT}`
);

});