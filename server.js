let express = require('express'),
    path = require('path'),
    mongoose = require('mongoose'),
    cors = require('cors'),
    bodyParser = require('body-parser'),
    dbConfig = require('./db/database');


// Connecting mongoDB
mongoose.Promise = global.Promise;
mongoose.connect(dbConfig.db, {
  useNewUrlParser: true
}).then(() => {
    console.log('Database connected');
  },
  error => {
    console.log('Database could not be connected : ' + error)
  }
);

// Setting up express
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(cors());

// Api root
const userRoute = require('./Routes/rules.route');
app.use('/api', userRoute);

// Create port
const port = process.env.PORT || 3000;

// Connecting port
const server = app.listen(port, () => {
  console.log('Port connected to: ' + port)
});

// Index Route
app.get('/', (req, res) => {
  res.send('Express api works!');
});

// error handler
app.use(function (err, req, res, next) {
  console.error(err.message);
  if (!err.statusCode) err.statusCode = 500;
  res.status(err.statusCode).send(err.message);
});

// Static build location
app.use(express.static(path.join(__dirname, 'dist')));