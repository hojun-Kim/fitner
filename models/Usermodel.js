const mongoose = require("mongoose"); // 몽구스를 가져온다.
const bcrypt = require("bcrypt"); // 비밀번호를 암호화 시키기 위해
const saltRounds = 10; // salt를 몇 글자로 할지
const jwt = require("jsonwebtoken"); // 토큰을 생성하기 위해
const { Timestamp } = require("mongodb");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    maxlength: 50,
  },
  gender: {
    type: String,
    enum: ['male', 'female'], // 남자 또는 여자만 허용
    required: true,
  },
  birthdate: {
    type: Date,
    required: true,
  },
  phoneNumber: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true, // 아이디는 고유해야 함
  },
  password: {
    type: String,
    required: true,
    minlength: 5, // 최소 5글자 이상
  },
  token : {
    type : String,
  },
  is_online: {
    type: String,
    default:'0'
  },
},
{ timestamps : true}
);

// save하기 전에 비밀번호를 암호화 시킨다.
userSchema.pre("save", function (next) {
  const user = this;
  // 비밀번호를 바꿀 때만 암호화 시킨다.
  if (user.isModified("password")) {
    bcrypt.genSalt(saltRounds, function (err, salt) {
      if (err) return next(err);
      bcrypt.hash(user.password, salt, function (err, hash) {
        if (err) return next(err);
        user.password = hash;
        next();
      });
    });
  } else {
    next();
  }
});

// 비밀번호를 비교하는 메소드
userSchema.methods.comparePassword = function (plainPassword) {
  const user = this;
  return bcrypt.compare(plainPassword, user.password);
};

// 토큰을 생성하는 메소드
userSchema.methods.generateToken = async function () {
  const user = this;
  // jsonwebtoken을 이용해서 token을 생성하기
  const token = jwt.sign(user._id.toHexString(), "secretToken");
  user.token = token;
  await user.save();
  return user;
};

// 토큰을 복호화하는 메소드
userSchema.statics.findByToken = function (token) {
  const user = this;
  // 토큰을 decode 한다.
  return new Promise((resolve, reject) => {
    jwt.verify(token, "secretToken", function (err, decoded) {
      if (err) return reject(err);
      // 유저 아이디를 이용해서 유저를 찾은 다음에
      // 클라이언트에서 가져온 token과 db에 보관된 토큰이 일치하는지 확인
      user.findOne({ _id: decoded, token: token }, function (err, user) {
        if (err) return reject(err);
        resolve(user);
      });
    });
  });
};

const User = mongoose.model("User", userSchema); // 스키마를 모델로 감싸준다.

//module.exports = { User }; // 다른 곳에서도 사용할 수 있도록 export 해준다.

module.exports = User;