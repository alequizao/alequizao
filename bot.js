const { Client, LocalAuth, MessageMedia} = require('whatsapp-web.js');
const { List, Buttons } = require('whatsapp-web.js');

const fs = require('fs');
const path = require('path');


const express = require('express');
const { body, validationResult } = require('express-validator');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fileUpload = require('express-fileupload');
const axios = require('axios');
const mime = require('mime-types');
const port = process.env.PORT || 8999;
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));
app.use(fileUpload({
  debug: true
}));
app.use("/", express.static(__dirname + "/"))

app.get('/', (req, res) => {
  res.sendFile('index.html', {
    root: __dirname
  });
});

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'bot-zdg' }),
  puppeteer: { headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // <- this one doesn't works in Windows
      '--disable-gpu'
    ] }
});

client.initialize();

io.on('connection', function(socket) {
  socket.emit('message', '© BOT-@alequizao - Iniciado');
  socket.emit('qr', './icon.svg');

client.on('qr', (qr) => {
  console.log('QR RECEIVED', qr);
  qrcode.toDataURL(qr, (err, url) => {
    socket.emit('qr', url);
    socket.emit('message', '© BOT-@alequizao QRCode recebido, aponte a câmera  seu celular!');
  });
});

client.on('ready', () => {
  socket.emit('ready', '© BOT-@alequizao Dispositivo pronto!');
  socket.emit('message', '© BOT-@alequizao Dispositivo pronto!');
  socket.emit('qr', './check.svg')	
  console.log('© BOT-@alequizao Dispositivo pronto');
});

client.on('authenticated', () => {
  socket.emit('authenticated', '© BOT-@alequizao Autenticado!');
  socket.emit('message', '© BOT-@alequizao Autenticado!');
  console.log('© BOT-@alequizao Autenticado');
});

client.on('auth_failure', function() {
  socket.emit('message', '© BOT-@alequizao Falha na autenticação, reiniciando...');
  console.error('© BOT-@alequizao Falha na autenticação');
});

client.on('change_state', state => {
  console.log('© BOT-@alequizao Status de conexão: ', state );
});

client.on('disconnected', (reason) => {
  socket.emit('message', '© BOT-@alequizao Cliente desconectado!');
  console.log('© BOT-@alequizao Cliente desconectado', reason);
  client.initialize();
});
});

// Enviar mensagem
app.post('/send-message', [
  body('number').notEmpty(),
  body('message').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  const number = req.body.number;
  const numberDDI = number.substr(0, 2);
  const numberDDD = number.substr(2, 2);
  const numberNumber = number.substr(4);

  const checkNumber = `${numberDDI}${numberDDD}${numberNumber}`;

  let wappNumber;
  if (numberDDI === '55') {
    wappNumber = `+${checkNumber}`;
  } else {
    wappNumber = `+${numberDDI}${numberDDD}${numberNumber}`;
  }

  const bodyMessage = req.body.message;

  const responseSend = await client.sendMessage(wappNumber, bodyMessage);

  if (responseSend) {
    return res.status(200).json({
      status: true,
      message: 'Mensagem enviada com sucesso!'
    });
  }

  return res.status(200).json({
    status: false,
    message: 'Erro ao enviar mensagem!'
  });

});

// Enviar imagem/arquivo/documento/etc
app.post('/send-file', [
  body('urlFile').notEmpty(),
  body('message').notEmpty(),
  body('number').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  const number = req.body.number;
  const numberDDI = number.substr(0, 2);
  const numberDDD = number.substr(2, 2);
  const numberNumber = number.substr(4);

  const checkNumber = `${numberDDI}${numberDDD}${numberNumber}`;

  let wappNumber;
  if (numberDDI === '55') {
    wappNumber = `+${checkNumber}`;
  } else {
    wappNumber = `+${numberDDI}${numberDDD}${numberNumber}`;
  }

  const bodyMessage = req.body.message;
  const urlFile = req.body.urlFile;
  
  const responseName = await axios.get(urlFile);
  const nameFile = responseName.request.path.split('/').slice(-1)[0];
  const fileType = mime.lookup(nameFile);
  const stream = await axios.get(urlFile, {
    responseType: 'stream'
  });

  const file = await stream.data

  if (fileType.includes('audio')) {
    await client.sendMessage(wappNumber, {
      body: bodyMessage,
      audio: new MessageMedia(file, nameFile),
    });
  }

  if (fileType.includes('video')) {
    await client.sendMessage(wappNumber, {
      body: bodyMessage,
      video: new MessageMedia(file, nameFile),
    });
  }

  if (fileType.includes('image')) {
    await client.sendMessage(wappNumber, {
      body: bodyMessage,
      image: new MessageMedia(file, nameFile),
    });
  }

  if (fileType.includes('pdf')) {
    await client.sendMessage(wappNumber, {
      body: bodyMessage,
      document: new MessageMedia(file, nameFile),
    });
  }

  return res.status(200).json({
    status: true,
    message: 'Arquivo enviado com sucesso!'
  });
});

// Enviar localização
app.post('/send-location', [
  body('longitude').notEmpty(),
  body('latitude').notEmpty(),
  body('message').notEmpty(),
  body('number').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  const number = req.body.number;
  const numberDDI = number.substr(0, 2);
  const numberDDD = number.substr(2, 2);
  const numberNumber = number.substr(4);

  const checkNumber = `${numberDDI}${numberDDD}${numberNumber}`;

  let wappNumber;
  if (numberDDI === '55') {
    wappNumber = `+${checkNumber}`;
  } else {
    wappNumber = `+${numberDDI}${numberDDD}${numberNumber}`;
  }

  const bodyMessage = req.body.message;
  const latitude = req.body.latitude;
  const longitude = req.body.longitude;
  
  await client.sendLocation(wappNumber, latitude, longitude, {
    text: bodyMessage
  });
  
  return res.status(200).json({
    status: true,
    message: 'Localização enviada com sucesso!'
  });
});





// Armazena a hora da última mensagem enviada
let ultimaMensagem = null;

// Números que serão excluídos da automação
const numerosExcluidos = ["+5582981173914", "+5582991935922", "+5582988717072"];

client.on('message', async msg => {

  // Verifica se o remetente da mensagem está na lista de exclusão
  if (numerosExcluidos.includes(msg.from)) {
    // Ignora a mensagem ou executa uma ação diferente
    return;
  }

  if (msg.body !== null && msg.body === "1") {
    msg.reply(" ");
  } 

  else if (msg.body !== null || msg.body === "0" || msg.type !== 'ciphertext') {
    // Verifica se já se passaram 5 minutos desde a última mensagem
    if (ultimaMensagem === null || (new Date() - ultimaMensagem) >= 5 * 60 * 1000) {
      msg.reply("Olá. *Essa é uma mensagem automática*. \n Estamos em manutenção. \n Informaremos assim que a manutenção terminar!");
      // Atualiza a hora da última mensagem enviada
      ultimaMensagem = new Date();
    }
  }
});














server.listen(port, () => {
  console.log(`🚀 Iniciou o servidor na porta: ${port}`);
});

process.on('SIGINT', function() {
  console.log('© BOT-@alequizao - Finalizando o servidor');
  client.logout();
  process.exit();
});