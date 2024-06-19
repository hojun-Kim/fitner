// dotenv 환경 변수 사용
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const socketIo = require("socket.io");
const multer = require('multer');
const fs = require('fs');
const { MongoClient, ObjectId } = require('mongodb');
// 모델 가져오기
const User = require('./models/Usermodel');
const Match = require('./models/Matchmodel');

const { Routine } = require('./models/routine');  // 루틴 모델 추가

//const ChatRoom = require('./models/chatroommodel');
const Message = require('./models/messagemodel');
const { ChatRoom, createChatRoomWithUserEmails } = require('./models/chatroommodel');

// 미들웨어 가져오기
const { auth } = require('./middleware/auth');

// 라우트 가져오기
const matchRoute = require('./routes/match');

const app = express();

// EJS 설정
app.set('view engine', 'ejs');
const path = require('path');
app.set('views', path.join(__dirname, 'views'));

// 미들웨어 사용
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({origin : true}));
app.use(express.static('public')); // 정적 파일 제공

// WebSocket 서버 설정
const server = http.createServer(app);
const io = socketIo(server);

// 데이터베이스 연결
mongoose.connect(process.env.DB_URL, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('MongoDB connected');
});


io.on('connection', (socket) => {
  console.log('User connected'); // 클라이언트 연결 시 로그
  socket.on('disconnect', () => {
    console.log('User disconnected'); // 클라이언트 연결 해제 시 로그
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`)); // 서버 실행 로그

// 세션 설정
app.use(session({
  secret: 'your_secret_key_here',
  resave: false,
  saveUninitialized: true,
  store: MongoStore.create({
    mongoUrl: process.env.DB_URL,
  })
}));


const wss = new WebSocket.Server({ server });
let waitingUsers = [];

wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
      const data = JSON.parse(message);

      if (data.type === 'register') {
          ws.userId = data.userId;
          ws.userName = data.userName;
      }

      if (data.type === 'match_request') {
          if (waitingUsers.length > 0) {
              const partner = waitingUsers.pop();
              ws.partnerId = partner.userId;
              ws.partnerName = partner.userName;
              partner.partnerId = ws.userId;
              partner.partnerName = ws.userName;

    

              ws.send(JSON.stringify({ type: 'match', partnerId: partner.userId, partnerName: partner.userName }));
              partner.send(JSON.stringify({ type: 'match', partnerId: ws.userId, partnerName: ws.userName}));
          } else {
              waitingUsers.push(ws);
          }
      }

      if (data.type === 'message') {
        const chatRoom = await ChatRoom.findOne({ roomId: data.roomId });
  
          wss.clients.forEach((client) => {
            if (client.userId === data.recipientId && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'message', text: data.text, userName: data.userName, time: data.time }));
            }
          });
        
      }
  });

  ws.on('close', () => {
      waitingUsers = waitingUsers.filter(user => user !== ws);
  });
});


// 라우트 설정
app.use('/api/match', matchRoute);

//홈
app.get('/enter', (req, res) => {
    console.log(req.session.user);
    if(req.session.user) {
    console.log("세션 유지");
    res.render("enter.ejs", {user : req.session.user});
  }
  else{
    console.log("user : null");
    res.render("enter.ejs", {user: null});
  }
});

app.get('/home', (req, res) =>{
  console.log(req.session.user);
    if(req.session.user) {
    console.log("세션 유지");
    res.render("home.ejs", {user : req.session.user});
  }
  else{
    console.log("user : null");
    res.render("home.ejs", {user: null});
  }
});


// 로그인 기능
app.get("/login", function(req, res){
  console.log(req.session);
  if(req.session.user){
      console.log('세션 유지');
      res.render('home.ejs', {user : req.session.user});
  }
  else{
      res.render("login.ejs");
  }
});
// 로그인 페이지 렌더링
app.post('/api/users/login', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(400).json({
        loginSuccess: false,
        message: '이메일에 해당하는 유저가 없습니다.',
      });
    }

    const isMatch = await user.comparePassword(req.body.password);
    if (!isMatch) {
      return res.status(400).json({
        loginSuccess: false,
        message: '비밀번호가 틀렸습니다.',
      });
    }

    await user.generateToken();
    // 성공한 경우에만 세션에 사용자 정보 저장
    req.session.user = {
      email : user.email,
      name : user.name,
    };  

    console.log(req.session.user);

    res.cookie('x_auth', user.token).status(200).json({ loginSuccess: true, userId: user._id });

  } catch (error) {
    console.error('로그인 중 오류 발생:', error);
    res.status(500).json({ loginSuccess: false, message: '로그인 중 오류가 발생했습니다.' });
  }
    
});


//로그아웃
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('로그아웃 실패');
    }
    res.redirect('/home');
  });
});

//회원가입
app.get('/register', (req, res) => {
  res.render('register');
});


// 회원가입 정보 DB test/users에 저장
app.post('/api/users/register', async (req, res) => {
  console.log('회원가입 필요 body  : ', req.body);
  const user = new User(req.body);
  try {
    await user.save();
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('회원가입 실패:', err);
    return res.status(400).json({ success: false, err: err.message });
  }
});

app.post('/api/users/checkDuplicate', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (user) {
      res.json({ duplicate: true });
    } else {
      res.json({ duplicate: false });
    }
  } catch (error) {
    console.error('중복 확인 중 오류 발생:', error);
    res.status(500).json({ error: '서버 오류로 중복 확인에 실패했습니다.' });
  }
});

app.get('/api/users/auth', auth, (req, res) => {
  res.status(200).json({
    _id: req.user._id,
    isAdmin: req.user.role === 0 ? false : true,
    isAuth: true,
    email: req.user.email,
    name: req.user.name,
    role: req.user.role,
  });
});

app.get('/api/users/logout', auth, async (req, res) => {
  try {
    await User.findOneAndUpdate({ email: req.user.email }, { token: '' });
    res.status(200).send({ success: true });
  } catch (err) {
    console.error('로그아웃 중 오류 발생:', err);
    res.status(500).json({ success: false, err: err.message });
  }
});

app.post('/api/chat/sendMessage', async (req, res) => {
  try {
    const { senderId, receiverId, message } = req.body;

    const newMessage = new Chat({
      message,
      sender: senderId,
      receiver: receiverId,
    });

    await newMessage.save();
    res.status(200).json({ success: true, message: '메시지가 성공적으로 전송되었습니다.' });
  } catch (error) {
    console.error('메시지 전송 중 오류 발생:', error);
    res.status(500).json({ success: false, message: '메시지 전송 중 오류가 발생했습니다.' });
  }
});

// 매칭하기 버튼 클릭 이벤트 처리
app.post('/match', async (req, res) => {
  // 매칭 로직 구현 (예시 코드에서는 생략)
  const matchedUser = await findMatch(req.user);

  if (matchedUser) {
    // 방 ID 생성 (UUID 사용 예시)
    const roomId = uuidv4();

    // 방 정보 데이터베이스에 저장
    await saveRoomInfo(roomId, [req.user.id, matchedUser.id]);

    // 사용자에게 방 ID 전달
    res.json({ success: true, roomId: roomId });
  } else {
    res.json({ success: false, message: '매칭된 상대방이 없습니다.' });
  }
});

// Matching
app.post('/api/match', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const matches = await User.find({
      _id: { $ne: req.user._id },
      // Add matching criteria here based on user preferences
    });
    res.status(200).json(matches);
  } catch (err) {
    res.status(500).json({ success: false, message: '매칭 중 오류가 발생했습니다.' });
  }
});

// Chat page
app.get('/chat', (req, res) => {
  if (req.session.user) {
    res.render("chat.ejs", { user: req.session.user });
  } else {
    res.redirect("/login");
  }
});

app.get('/mymate', (req, res) => {
  res.render('mymate.ejs');
});

app.post('/api/leaveChat', async (req, res) => {
  const { userId, partnerId } = req.body;

    try {
        await client.connect();
        const database = client.db("test");
        const users = database.collection("matches");

        // 사용자의 "마이메이트" 정보에 partnerId 추가
        const result = await users.updateOne(
            { _id: new ObjectId(userId) },
            { $addToSet: { myMates: partnerId } } // $addToSet은 중복을 방지하면서 배열에 값을 추가합니다.
        );

        if (result.modifiedCount === 1) {
            res.json({ message: '마이메이트 정보 업데이트 성공' });
        } else {
            res.status(400).json({ message: '마이메이트 정보 업데이트 실패' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: '서버 오류' });
    } finally {
        await client.close();
    }
});

app.get('/chat/list/:id', function(req,res){
  console.log(req.params.id);
  req.params.id = new ObjectId(req.params.id);
  res.render('matchfriend.ejs');
});

app.get('/matchlist', (req, res) => {
  res.render('matchlist.ejs');
});

app.get('/match/evaluation', (req, res) => {
  res.render('matchevaluation.ejs');
});

let reviewData = {}; // To store review and rating data

// Route to handle review submission from matchevaluation.ejs
app.post('/submitReview', (req, res) => {
  reviewData = req.body; // Assuming review and rating data is sent in the body
  res.status(200).send('Review submitted successfully');
});

// Route to render beforematch.ejs with review data
app.get('/matchlist/user1', (req, res) => {
    res.render('beforematch', { reviewData });
});

app.get('/makeroutine', (req, res) => {
  res.render('makeRoutine.ejs');
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const routineName = req.body.routineName;
    if (!routineName) {
      return cb(new Error('루틴 이름이 필요합니다.'));
    }
    const uploadPath = path.join(__dirname, 'public', 'fitner', 'uploads', routineName);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('파일이 업로드되지 않았습니다.');
  }

  const newImage = new Image({
    filename: req.file.filename,
    path: req.file.path,
    mimetype: req.file.mimetype,
    size: req.file.size,
  });

  try {
    await newImage.save();
    res.send(`파일이 성공적으로 업로드되었습니다: ${req.file.filename}`);
  } catch (err) {
    console.error('파일을 데이터베이스에 저장하는 중 오류 발생:', err);
    res.status(500).send('파일을 데이터베이스에 저장하는 중 오류가 발생했습니다.');
  }
});

app.post('/createRoutine', upload.single('file'), async (req, res) => {
  const relatedLinks = req.body.relatedLinks ? JSON.parse(req.body.relatedLinks) : [];

  const routine = new Routine({
    name: req.body.routineName,
    equipment: req.body.equipment,
    time: req.body.time,
    description: req.body.description,
    link: relatedLinks,
    file: req.file ? req.file.filename : null
  });

  try {
    await routine.save();
    // Using res.send to send a script that shows an alert and then redirects the user
    res.send(`
      <script>
        alert('루틴이 성공적으로 생성되었습니다.');
        window.location.href = '/routine';
      </script>
    `);
  } catch (err) {
    console.error('루틴 생성 중 오류 발생:', err);
    res.status(500).send('루틴 생성 중 오류가 발생했습니다.');
  }
});

app.get('/routine', async (req, res) => {
  try {
    const routines = await Routine.find({});
    res.render('routine.ejs', { routines });
  } catch (err) {
    console.error('루틴 조회 중 오류 발생:', err);
    res.status(500).send('루틴 조회 중 오류가 발생했습니다.');
  }
});

app.get('/routine/:id', async (req, res) => {
  try {
    const routine = await Routine.findById(req.params.id);
    if (!routine) {
      return res.status(404).send('루틴을 찾을 수 없습니다.');
    }
    res.render('routineDetail.ejs', { routine });
  } catch (err) {
    console.error('루틴 조회 중 오류 발생:', err);
    res.status(500).send('루틴 조회 중 오류가 발생했습니다.');
  }
});

app.post('/uploadRoutine', upload.single('file'), (req, res) => {
  const routineName = req.body.routineName;
  const exerciseEquipment = req.body.exerciseEquipment;
  const exerciseTime = req.body.exerciseTime;
  const description = req.body.description;
  const linkText = req.body.linkText;

  console.log('Routine created:', {
    routineName,
    exerciseEquipment,
    exerciseTime,
    description,
    linkText,
    file: req.file
  });

  res.send('루틴이 성공적으로 생성되었습니다.');
});

app.get('/calendar', (req, res) => {
  res.render('calendar.ejs');
});

app.get('/calendar/info', (req, res) => {
  res.render('info.ejs');
});

app.get('/calendar/week', (req, res) => {
  res.render('week.ejs');
});

app.get('/dead/1', (req, res) => {
  res.render('dead1.ejs');
});
app.get('/dead/2', (req, res) => {
  res.render('dead2.ejs');
});
app.get('/dead/3', (req, res) => {
  res.render('dead3.ejs');
});
app.get('/dead/4', (req, res) => {
  res.render('dead4.ejs');
});

const jwt = require('jsonwebtoken');

// 토큰 생성
const token = jwt.sign({ userId: 123 }, 'your-256-bit-secret', { expiresIn: '1h' });

// 토큰 검증
jwt.verify(token, 'your-256-bit-secret', (err, decoded) => {
  if (err) {
    console.error('Token verification failed:', err);
  } else {
    console.log('Decoded token:', decoded);
  }
});
