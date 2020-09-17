const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const mongo = require('mongodb')
const cors = require('cors')
require('dotenv').config()

const mongoose = require('mongoose')
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use(cors())
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

// Schema and Model to connect to database

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  log: [{
    description: { type: String },
    duration: { type: Number },
    date: { type: Date, default: Date.now() }
  }]
})

const User = mongoose.model('user', userSchema);

// Endpoint to index

app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// Create new user

app.post("/api/exercise/new-user", async (req, res) => {
  try {
    const newUsername = req.body.username;

    console.log("Username for a new user => ", newUsername);

    const objectUser = await User.findOne(
      {
        username: newUsername,
      },
      (err, data) => {
        if (err) {
          console.log(err);
        } else {
          return data;
        }
      }
    );

    console.log("User found => ", objectUser);

    if (!objectUser) {
      const newUser = {
        username: newUsername,
        log: [],
      };

      console.log("New user => ", newUser);

      const signUpUser = await new User(newUser).save();

      const response = {
        _id: signUpUser._id,
        username: signUpUser.username,
      };

      res.status(201).json(response);
    } else {
      res.status(400).json("This username is already taken");
    }
  } catch (err) {
    console.log("Async error", err);
  }
});


//---------------- Get list of users

app.get('/api/exercise/users', async (req,res)=>{
  try{
    const listUsers = await User.find().select({ 'log': 0 });
    console.log("Intro query for the list of users => ", listUsers)

    // const test = Array.isArray(listUsers)

    // console.log(test)

    res.status(400).json(listUsers)

  } catch(err){
    if(err){
      console.log("Async error => ", err)
    }
  }
});

//---------------- Add exercises

app.post('/api/exercise/add', async (req, res)=>{
try{
  const { userId, description, duration } = req.body;
  var { date } = req.body;

  console.log("Query to add exercise => ", req.body)

  if (!description) description = 'No description provided';
  if (!duration) duration = 0;

  if (/^(19[0-9]{2}|2[0-9]{3})-(0[1-9]|1[012])-([123]0|[012][1-9]|31)$/.test(date)){
    date = new Date(date)
  } else {
    date = Date.now();
    date = new Date(date)
  }

  console.log("Intro date: ", req.body.date)
  console.log("Saved date: ", date);

  const toAdd = {
    description: description,
    duration: parseInt(duration),
    date: date
  }

  console.log(userId);
  console.log(parseInt(duration));

  const findUser = await User.findById(userId);

  console.log(findUser)

  if(findUser){
    await findUser.log.push(toAdd)
    await findUser.save()
    
    res.status(400).json({
    username:findUser.username, 
    description: description,
    duration: parseInt(duration),
    _id: userId,
    date: date
    })
  } else {
    res.json("This user do not exist. Please try again")
  }

} catch (err) {
  if (err) {
    console.log("Async error", err)
  }
}
});

//---------------- Get exercise log of one user

app.get('/api/exercise/log?', async (req, res)=>{
  try{
    const { userId, from, to, limit } = req.query

    console.log("Entra query para log con parametros => ", req.query)

    const findUser = await User.findById(userId);

    if(findUser){

      const { username, log } = findUser;

      let arrayExr = [...log];
      
      if(/^(19[0-9]{2}|2[0-9]{3})-(0[1-9]|1[012])-([123]0|[012][1-9]|31)$/.test(from)) {
        const dateFrom = new Date(from);
        console.log ("From => ", dateFrom);
        arrayExr = arrayExr.filter(exercise => exercise.date >= dateFrom);
      }

      if(/^(19[0-9]{2}|2[0-9]{3})-(0[1-9]|1[012])-([123]0|[012][1-9]|31)$/.test(to)) {
        const dateTo = new Date(to);
        console.log ("To => ", dateTo);
        arrayExr = arrayExr.filter(exercise => exercise.date <= dateTo);
      }

      if(limit) {
        console.log(arrayExr)
        arrayExr = arrayExr.slice(0, limit)
      }

      const {length: count} = arrayExr;


      res.status(200).json({
        _id: userId, 
        username: username, 
        log: arrayExr, 
        count: count})

    } else {
      res.status(400).json("UserId not found")
    }

  } catch(err){
    if(err){
      console.log("Async error => ", err)
    }
  }
});

// Define server status

const serverStatus = () => {
  return {
    state: 'up',
    dbState: mongoose.STATES[mongoose.connection.readyState]
  }
};

//  Plug into middleware.
app.use('/api/uptime', require('express-healthcheck')({
  healthy: serverStatus
}));

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
