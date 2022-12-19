const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { query } = require('express');
require('dotenv').config()

const port = process.env.PORT || 5000;

const app = express();

// MiddleWare
app.use(express.json());
app.use(cors());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2psefg9.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }


    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decode) {
        if (err) {
            return res.status(403).send({ message: "Forbiten Access" })
        }

        req.decode = decode;
        next()


    })
}

async function run() {
    try {
        const appointmentCollection = client.db('doctorPortal').collection('AppoinmentOption');
        const bookingsCollection = client.db('doctorPortal').collection('bookings');
        const usersCollection = client.db('doctorPortal').collection('users');
        const doctorsCollection = client.db('doctorPortal').collection('doctors');

        // NOTE: make sure you use verifyAdmin after verifyJWT
        const verifyAdmin = async (req, res, next) => {
            console.log(req.decode.email);
            const decodeEmail = req.decode.email;
            const query = { email: decodeEmail };
            const user = await usersCollection.findOne(query);
            if (user?.role !== "admin") {
                return res.status(403).send({ message: "forbiten access" })
            }
            next()
        }

        app.get('/appointmentOptions', async (req, res) => {
            const date = req.query.date;
            // console.log(date);
            const query = {};
            const options = await appointmentCollection.find(query).toArray();
            const bookingQuery = { appointmentDate: date };
            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();
            options.forEach(option => {
                const optionBooked = alreadyBooked.filter(book => book.treatment === option.name);
                const bookedSlots = optionBooked.map(book => book.slot);
                const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
                option.slots = remainingSlots;
                // console.log(date, option.name, remainingSlots.length);
            })
            res.send(options);
        });

        app.get('/appointmentSpecialty', async (req, res) => {
            const query = {};
            const result = await appointmentCollection.find(query).project({ name: 1 }).toArray();
            res.send(result)
        })

        //Booking Apis

        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodeEmail = req.decode.email;

            if (email !== decodeEmail) {
                return res.status(403).send({ message: "forbiten access" })
            }
            const query = { email: email };
            const result = await bookingsCollection.find(query).toArray()
            res.send(result)
        })

        app.post('/bookings', async (req, res) => {

            const booking = req.body;
            // console.log(booking);
            const result = await bookingsCollection.insertOne(booking);
            res.send(result);
        });

        //Users Api

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: "1h" })
                res.send({ accessToken: token })

            }

            res.status(403).send({ accessToken: "" })
        })

        app.get('/users', async (req, res) => {
            const query = {};
            const user = await usersCollection.find(query).toArray();
            res.send(user)
        });

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === "admin" })
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })
        app.put('/users/admin/:id', verifyJWT, verifyAdmin, async (req, res) => {
           
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

        })

        // Doctors Collection Api

        app.get('/doctors', verifyJWT, verifyAdmin, async (req, res) => {
            const quary = {};
            const result = await doctorsCollection.find(quary).toArray();
            res.send(result)
        })

        app.post('/doctors', verifyJWT, verifyAdmin, async (req, res) => {
            const doctor = req.body;
            const result = await doctorsCollection.insertOne(doctor);
            res.send(result)

        })

        app.delete('/doctors/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await doctorsCollection.deleteOne(filter);
            res.send(result)
        })
    }
    finally {

    }
}
run()

app.get('/', async (req, res) => {
    res.send('Doctors Portal Server is Running')
})

app.listen(port, () => console.log(`Doctors portal running on ${port}`))