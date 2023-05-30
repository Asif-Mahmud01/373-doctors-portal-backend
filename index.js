const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 5000

const app = express()

app.use(cors()); 0
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zbisngo.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

function verifyJWT(req, res, next) {
    console.log('token inside verifyJWT', req.headers.authorization)
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unautorized access')
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next()
    })
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        await client.close();
    }
}
run().catch(console.dir);

async function run() {
    try {
        const appointmentOptionsCollection = client.db('doctorsPortal').collection('appointmentOptions')
        const bookingsCollection = client.db('doctorsPortal').collection('bookingss')
        const usersCollection = client.db('doctorsPortal').collection('userss')
        const doctorsCollection = client.db('doctorsPortal').collection('doctorss')
        app.get('/appointmentOptions', async (req, res) => {
            const date = req.query.date

            const query = {};
            const options = await appointmentOptionsCollection.find(query).toArray()
            const bookingQuery = { appointmentDate: date }
            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray()

            options.forEach(option => {
                const optionBooked = alreadyBooked.filter(book => book.treatment === option.name)
                const bookedSlots = optionBooked.map(book => book.slot)
                const remainingSlot = option.slots.filter(slot => !bookedSlots.includes(slot))
                option.slots = remainingSlot
            })
            res.send(options)
        })

        // app.get('/v2/appointmentOptions', async (req, res) => {
        //     const date = req.query.date;
        //     const options = await appointmentOptionCollection.aggregate([
        //         {
        //             $lookup: {
        //                 from: 'bookings',
        //                 localField: 'name',
        //                 foreignField: 'treatment',
        //                 pipeline: [
        //                     {
        //                         $match: {
        //                             $expr: {
        //                                 $eq: ['$appointmentDate', date]
        //                             }
        //                         }
        //                     }
        //                 ],
        //                 as: 'booked'
        //             }
        //         },
        //         {
        //             $project: {
        //                 name: 1,
        //                 slots: 1,
        //                 booked: {
        //                     $map: {
        //                         input: '$booked',
        //                         as: 'book',
        //                         in: '$$book.slot'
        //                     }
        //                 }
        //             }
        //         },
        //         {
        //             $project: {
        //                 name: 1,
        //                 slots: {
        //                     $setDifference: ['$slots', '$booked']
        //                 }
        //             }
        //         }
        //     ]).toArray();
        //     res.send(options);
        // })

        app.get('/appointmentSpecialty', async (req, res) => {
            const query = {}
            const result = await appointmentOptionsCollection.find(query).project({ name: 1 }).toArray()
            res.send(result)
        })

        app.get('/bookingss', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;

            if (email !== decodedEmail) {
                return res.status(403).status({ message: 'forbidden access' })
            }

            const query = { email: email }
            const bookings = await bookingsCollection.find(query).toArray()
            res.send(bookings)
        })

        app.post('/bookingss', async (req, res) => {
            const booking = req.body;
            const query = {
                appointmentDate: booking.appointmentDate,
                treatment: booking.treatment
            }
            const alreadyBooked = await bookingsCollection.find(query).toArray()
            if (alreadyBooked.length) {
                const message = `You already have a booking on ${booking.appointmentDate}`
                return res.send({ acknowledge: false, message })
            }
            const result = await bookingsCollection.insertOne(booking)
            res.send(result)
        });

        // app.get('/jwt', async(req, res) =>{
        //     const email = req.query.email
        //     const query = {email: email}
        //     const user = await usersCollection.findOne()
        //     if(user){
        //         const token = jwt.sign({email},process.env.ACCESS_TOKEN, {expiresIn: '1hr'})
        //         return res.send({accessToken: 'token'})
        //     }
        //     res.status(403).send({accessToken: ''})
        // })


        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: '' })
        });


        app.get('/userss', async (req, res) => {
            const query = {};
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        });


        app.get('/userss/admin/:email', async (req, res) => {
            // const id = req.params.id
            // const query = {_id: ObjectId(id)}
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        })


        app.post('/userss', async (req, res) => {
            const user = req.body
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })

        app.put('/userss/admin/:id', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

        app.get('/doctorss', async (req, res) => {
            const query = {};
            const doctors = await doctorsCollection.find(query).toArray();
            res.send(doctors);
        })

        app.post('/doctorss', async (req, res) => {
            const doctor = req.body;
            const result = await doctorsCollection.insertOne(doctor);
            res.send(result);
        });

        // app.delete('/doctorss/:id', verifyJWT, verifyAdmin, async (req, res) => {
        //     const id = req.params.id;
        //     const filter = { _id: ObjectId(id) };
        //     const result = await doctorsCollection.deleteOne(filter);
        //     res.send(result);
        // })

    }
    finally {

    }
}

app.get('/', async (req, res) => {
    res.send('doctors portal server is running')
})

app.listen(port, () => console.log(`doctors portal running on ${port}`))