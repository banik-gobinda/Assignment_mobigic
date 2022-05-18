//	Enter the answer in any programming language you desire

const express = require('express')
const http = require('http')
const path = require('path')
const cors = require('cors')
const router = express.Router();
const PORT = 3000
const app = express()  //instance of express
const server = http.createServer(app);
const jwt = require('jsonwebtoken');
const JWT_SECRET_KEY = "gobinda@123"
const JWT_EXP = "3h"
const fs = require("fs");
const { dirname } = require('path');
const multer  = require('multer');


// DataBase Config
const dbConfig = {
    HOST: "localhost",
    USER: "postgres",
    PASSWORD: "password",
    DB: "postgres",
    dialect: "postgres",
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  };
  
// Sequelize connection details  
const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
  host: dbConfig.HOST,
  dialect: dbConfig.dialect,

  pool: {
    max: dbConfig.pool.max,
    min: dbConfig.pool.min,
    acquire: dbConfig.pool.acquire,
    idle: dbConfig.pool.idle
  }
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// user model
const User = (sequelize, Sequelize) => {
    const User = sequelize.define("user", { 
      username: {
        type: Sequelize.STRING
      },
      password: {
        type: Sequelize.STRING
      },
    });
  
};

global.__basedir = __dirname;

const env = process.env.NODE_ENV || 'development';

app.use(cors({ origin: "*" }))


app.use(express.json({limit: '1024mb'}));
app.use(express.urlencoded({limit: '1024mb', extended: true}));

// JWT Verify middleware
const verifyJwtToken = (req,res,next) =>{
    var token;
    if('authorization' in req.headers){
        token = req.headers['authorization'].split(' ')[1];
    }

    if(!token){
        return res.status(403).json({auth:false, message: "NO_TOKEN_PROVIDED"});
    }else{
        jwt.verify(token, JWT_SECRET_KEY, (err, decoded) => {
            if(err){
                return res.status(500).send({auth :false , message : 'TOKEN_AUTHENTICATION_FAILED'})
            }else{
                req.userid= decoded.userid;
                console.log(decoded);
                next()
            }
        })
    }
}

// user register api
const signUp = async (req, res) =>{

    try{
        let { username, password } = req.body;
        let data = req.body
        const newUser =  await User.create(data);
        res.status(201).json({status:true, message: 'SIGNUP_SUCCESSFULLY', data : newUser});

    }catch(err){
        res.status(500).json({status:false, message: 'ERROR', err});
    }

} 

// user login api
const login = async (req, res) =>{
    try{
        const {username,password} = req.body;
        const user = await User.findOne({ where: {username} });

        if(user == null){
            return res.status(404).json({status:false, message: "USER_NOT_FOUND"});
        }

        const token = await generateJwt(user.dataValues);

        if(!token){
            return res.status(500).json({status:false, message: 'TOKEN_GENERATION_FAIL'})
        }
        res.status(200).json({status:true, message: "USER_AUTHENTICATE_SUCCESSFULLY", token})

    }catch(err){
        res.status(500).json({status:false, message: 'ERROR', err});
    }
} 

const generateJwt =  async (user) => {
    return jwt.sign({
      uid: user.id,
      username : user.username
    },JWT_SECRET_KEY,{
        expiresIn : JWT_EXP
    }); 
};

// multer for file upload
const storage = multer.diskStorage({   
    destination: function(req, file, cb) { 
       cb(null, './uploads/'+ req.userid);    
    }, 
    filename: function (req, file, cb) { 
       cb(null ,  Math.floor(100000 + Math.random() * 900000));   
    }
 });

const upload = multer({ storage: storage }).any('file') 
 
// api for file upload
const fileUpload = async (req, res) =>{
    try{

        upload(req, res, function (err) {
            if (err instanceof multer.MulterError) {
              return res.status(500).json({status:false, message: 'UPLOAD_FAIL', err});
            } else if (err) {
              return res.status(500).json({status:false, message: 'UPLOAD_FAIL', err});
            }
            
            res.status(201).json({status:true, message: 'UPLOAD_SUCCESSFULLY', path : ''});
          })

    }catch(err){
        res.status(500).json({status:false, message: 'ERROR', err});
    } 
} 

//api for get all files in login profile
const getListOfFiles = async (req, res) =>{
    try{
        const directoryPath = global.__basedir + "/uploads/"+ req.userid ;
        
        fs.readdir(directoryPath, function (err, files) {
            //handling error
            if (err) {
                return res.status(500).json({ status:false, message: "UNABLE_TO_SCAN_DIRECTORY" , err });
            } 
            res.status(200).json({status:true, message: 'ALL_DATA', files});
        });
        
    }catch(err){
        res.status(500).json({status:false, message: 'ERROR', err});
    } 
} 

// delete a file in login profile
const deleteFile = async (req, res) =>{
    try{
        const filename = req.params.id
        const directoryPath = global.__basedir + "/uploads/"+ req.userid + '/'+ filename ;
        
        fs.unlink(path, (err) => {
          if (err) {
            return res.status(500).json({ status:false, message: "UNABLE_TO_DELLETE_FILE" , err });
          }
        
         res.status(200).json({status:true, message: 'FILE_DELETED'});
        })
        
    }catch(err){
        res.status(500).json({status:false, message: 'ERROR', err});
    } 
} 

//api for download file
const fileDownload = async (req, res) =>{
    try{
        const fileName = req.params.filename;
        const directoryPath = global.__basedir + "/uploads/"+ req.userid +'/'+ fileName ;
    
        res.download(directoryPath, fileName, (err) => {
            if (err) {
                res.status(500).json({ status:false, message: "COULD_NOT_DOWNLOAD_THE_FILE" , err });
            }
        });
    }catch(err){
        res.status(500).json({status:false, message: 'ERROR', err});
    } 
}

// list of apis end points
app.post('/api/signup', signUp );
app.post('/api/login', login );
app.post('/api/fileupload', verifyJwtToken, fileUpload );
app.get('/api/getListOfFiles', verifyJwtToken, getListOfFiles );
app.delete('/api/file/:id', verifyJwtToken, deleteFile );
app.get('/api/filedownload/:id', verifyJwtToken, fileDownload );



// db connection pool
db.sequelize.sync().then(function() {
    console.log("Database Connected");
})    




// server running details
server.listen(PORT,'0.0.0.0', function(){
    console.log('Express server listening on port: ' + PORT);
});