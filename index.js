const express = require('express')
const app = express()
const port = process.env.PORT || 5000
require('dotenv').config()
const  ObjectId =  require('mongodb').ObjectId
const stripe = require('stripe')(process.env.STRIPE_SECRET)
const fileUpload = require('express-fileupload')
const admin = require("firebase-admin");

//doctor portal server site codes
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
async function verifyToken (req,res,next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];
        try{
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email
        }
        catch{

        }
    }
    next()
} 
const cors = require('cors')
app.use(cors())
app.use(express.json())
app.use(fileUpload())

const { MongoClient } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rf28w.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
async function run () {
    try{
        await client.connect();
        // console.log('database connected');

        const database = client.db("doctorsPortal");
        const appointmentsCollection = database.collection("appointments");
        const usersCollection = database.collection("users");
        const doctorsCollection = database.collection("doctors");

        app.post('/doctors', async (req, res) => {
            const data = req.body;
            const email = data.email
            const name = data.name
            const pic = req.files.image;
            const picData = pic.data
            const encodedPic = picData.toString('base64')
            const imageBuffer = Buffer.from(encodedPic, 'base64');
            // console.log(imageBuffer);
            // console.log(encodedPic);
            const doctor = {
                name, 
                email, 
                image : imageBuffer
            }
            const result = await doctorsCollection.insertOne(doctor)
            res.json(result)
        })
        app.get('/doctors', async (req, res) => {
            const result = await doctorsCollection.find({}).toArray()
            res.send(result)
        })
        app.get('/appointments',verifyToken, async (req,res) => {
            let query = {}
            const email = req.query.email
            const date1 = req.query.date
            const date = req.query.date
            console.log(date);
            console.log(date1);
            if(email){
                query = {email : email, date : date}
            }
            const cursor = appointmentsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })
        app.post('/appointments', async (req, res) => {
            const data = req.body
            const result = await appointmentsCollection.insertOne(data)
            res.json(result)
        }),
        app.post('/users', async (req, res) => {
            const users = req.body;
            const result = await usersCollection.insertOne(users)
            res.json(result)
        })
        app.put('/users', async (req, res) => {
            const data = req.body
            console.log(data);
            const filter = {email : data.email}
            const options = { upsert: true };
            const updateDoc = {
                $set: data,
              };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result)
        })
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email
            const query = {email : email}
            const user = await usersCollection.findOne(query)
            console.log(user);
            let isAdmin = false
            if(user?.role === "admin"){
                isAdmin = true
            } 
            res.send({admin : isAdmin})
        })
        app.get('/appointments/:id', async (req, res) => {
            const id = req.params
            const query  = {_id : ObjectId(id)}
            const result = await appointmentsCollection.findOne(query)
            res.json(result)
        })
        app.put('/appointments/:id', async (req, res) => {
            const id = req.params.id
            const payment = req.body
            const filter = {_id : ObjectId(id)}
            const updateDoc = {
                $set : {
                    payment : payment
                }
            }
            const result = await appointmentsCollection.updateOne(filter, updateDoc)
            res.json(result)
        })
        app.put('/users/admin',verifyToken, async (req,res) => {
            const data = req.body
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = usersCollection.findOne({email : requester})
                if (requesterAccount) {
                    const filter = {email : data.email}
                    const updateDoc = {
                        $set :{role : 'admin'}
                    }
                    const result = await usersCollection.updateOne(filter, updateDoc)
                    res.json(result)
                }
            }
            else{
                req.status(403).json({message : 'You do not have access make admin'})
            }
            
        })
        app.post("/create-payment-intent", async (req, res) => {
            const paymentInfo  = req.body
            const amount = paymentInfo.price * 100
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "eur",
                payment_method_types: [
                  "card"
                ],
              });
            res.json({clientSecret: paymentIntent.client_secret})
        })
        
    }
    finally{
        // await client.close();
    }
}
run().catch(console.dir)


app.get('/', (req, res) => {
    res.send('Doctor Portal')
})
app.listen(port, () => {
    console.log('Running On port', port);
})