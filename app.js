const express = require('express')
const { createServer } = require('http')
const mysql = require('mysql');
const {SerialPort} = require('serialport');
const {ReadlineParser} = require('@serialport/parser-readline');
const { autoDetect } = require('@serialport/bindings-cpp')
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();


// Create a connection to the MySQL database
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

const app = express()
const httpServer = createServer(app)
// const io = require('socket.io')(httpServer);
const bodyParser = require('body-parser')
let portStatus = false
let wsStatus = false
let serialPorts = []
const Binding = autoDetect()
let dataPayload

// io.on('connection', (socket) => {
//   console.log('a client connected');

//   socket.on('disconnect', () => {
//     console.log('client disconnected');
//   });
// });

SerialPort.list().then(function(ports) {
  // Open a serial port for each available port
  ports.forEach(function(port) {
    const serialPort = new SerialPort({ path: port.path,  baudRate: 9600, autoOpen: false })

    serialPorts.push(serialPort)

    // // Listen for data on the port
    // serialPort.on('data', function(data) {
    //   console.log('Data from port', port.path, ':', data.toString());
    // });
  });
});

app.use(cors());
app.use(bodyParser.json())

//IMPORT ROUTES
const postsRoute = require('./routes/posts');

// define a function that returns a promise
function query(sql, args) {
  return new Promise((resolve, reject) => {
    connection.query(sql, args, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

app.use('/posts', postsRoute)

//ROUTES
app.get('/', async (req, res) => {
  res.sendFile('views/index.html', {root: __dirname })
})

app.get('/get', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader("Content-Type", "application/json")

  try {
    const ports = await SerialPort.list()
    const setting = await query('SELECT * FROM settings LIMIT 1');
  
    res.json(
      {
        ok: true, 
        ports: ports.map((val, i) => {
          return {
            path: val.path,
            isOpen: false,
          }
        }),
        setting: setting[0]
      }
    )
  } catch (error) {
    throw error;
  } finally {
    res.end()
  }


})

app.get('/telemetries', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader("Content-Type", "application/json")
  try {
    let data = {}
    
    // Insert the data into the "monitoring_portable" table
    const result = await query('SELECT * FROM telemetries ORDER BY `created_at` DESC LIMIT 10');
    
    data.telemetries = result

    const result2 = await query('SELECT * FROM settings LIMIT 1');

    data.last_data_sent_at = result2[0].last_data_sent_at
    
    res.json(data)
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    res.end()
  }
})

app.post('/open', (req, res) => {
  console.log(req.body.port);

  const portIndex = serialPorts.findIndex(p => p.path === req.body.port);

  if (portIndex === -1) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(400)
    res.send({
      error: {
        message: "Port Tidak ditemukan"
      }
    });
    return console.log('Error opening port: ', "Port tidak ditemukan")
  }

  const port = serialPorts[portIndex]

  if (port.isOpen) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(400)
    res.send({
      error: {
        message: "Port already open"
      }
    });
    return console.log('Error opening port: ', "Port already open")
  }
  port.open((err) => {
    console.log('Port open');
    let errMessage = null
    if (err) {
      console.log(err);
      res.status(500)
      res.send({
        error: {
          message: err.message
        }
      });
      return console.log('Error opening port: ', err.message)
    }
    res.json({status: 'ok'})
    res.end()
  })
  
  // port listening
  const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
  parser.on('data', data =>{
    console.log('got word from arduino:');
    // const val = JSON.parse(data)

    // const contoh = "-6.967658000,107.658933667,734.30,1.57,284.07,119.80,11.80,1494.00,0,Siap,-244,1328,-14776,-115,213,260,*"

    let [suhu, kelembapan, tekanan, arah_angin, kecepatan_angin, cahaya = null, cuaca = null, lat = null, lng = null] = data.split(',')

    let date_ob = new Date();

    // current date
    // adjust 0 before single digit date
    let date = ("0" + date_ob.getDate()).slice(-2);

    // current month
    let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);

    // current year
    let year = date_ob.getFullYear();

    // current hours
    let hours = ("0"+date_ob.getHours()).slice(-2);

    // current minutes
    let minutes = ("0"+date_ob.getMinutes()).slice(-2);

    // current seconds
    let seconds = ("0"+date_ob.getSeconds()).slice(-2);

    // prints date & time in YYYY-MM-DD HH:MM:SS format
    const myDate = year + "-" + month + "-" + date + " " + hours + ":" + minutes + ":" + seconds

    // Define the data to be inserted
    const dataQeury = {
      suhu: suhu,
      kelembapan: kelembapan,
      arah_angin: arah_angin,
      tekanan: tekanan,
      kecepatan_angin: kecepatan_angin,
      cahaya: null,
      cuaca: cuaca,
      lat: lat,
      lng: lng,
      // perangkat_edge_no_seri: req.body.noSeriEdge,
      created_at: myDate,
    };

    // Insert the data into the "monitoring_portable" table
    connection.query('INSERT INTO telemetries SET ?', dataQeury, function(err, result) {
      if (err) throw err;
      console.log('Data inserted successfully.');
      // console.log('Result:', result);
    });
  });
})

app.post('/close', (req, res) => {
  console.log(req.body);
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const portIndex = serialPorts.findIndex(p => p.path === req.body.port);

  if (portIndex === -1) {
    res.status(400)
    res.send({
      error: {
        message: "Port Tidak ditemukan"
      }
    });
    return console.log('Error close port: ', "Port tidak ditemukan")
  }

  const port = serialPorts[portIndex]

  if (!port.isOpen) {
    res.status(400)
    res.send({
      error: {
        message: "Port already close"
      }
    });
    return console.log('Error opening port: ', "Port already close")
  }

  port.close((err) => {
    portStatus = false;
    if (err) {
      console.log(err);
      res.status(500)
      res.send({
        error: {
          message: err.message
        }
      });
      return console.log('Error opening port: ', err.message)
    }
    
    console.log('Port close');
    console.log(err);
    res.json({status: 'ok'})
    res.end()
  })
})

app.get('/get-telemetries-after-last-sent', async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader("Content-Type", "application/json")

    const result = await query('SELECT suhu, kelembapan, arah_angin, tekanan, kecepatan_angin, cahaya, cuaca, lat, lng FROM telemetries WHERE created_at > ?', req.query.last_sent_at);
    
    res.json(result)
  } catch (error) {
    throw error;
  } finally {
    res.end()
  }
})

app.post('/save-ip-server', async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader("Content-Type", "application/json")

    const result = await query('INSERT INTO settings (`ip_server`) VALUES (?)', req.body.ipServer)
    
    res.json({
      message: 'Berhasil disimpan'
    })
  } catch (error) {
    throw error;
  } finally {
    res.end()
  }
})

app.put('/save-latest-data-sent-at', async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader("Content-Type", "application/json")

    const result = await query('INSERT INTO settings (`last_data_sent_at`) VALUES (?)', req.body.timestamp)
    
    res.json({
      message: 'Berhasil disimpan'
    })
  } catch (error) {
    throw error;
  } finally {
    res.end()
  }
})

// Connect to DB
// const client = new Client({
//   user: 'postgres',
//   host: 'localhost',
//   database: 'testdb',
//   password: 'FelixItsMe#1412',
//   port: 5432,
// });

// client.connect();

// Connect to the database
connection.connect(function(err) {
  if (err) throw err;
  console.log('Connected to MySQL database.');
});

//START LISTENING
app.listen(7979, function () { console.log('Server started on port 7979')})
