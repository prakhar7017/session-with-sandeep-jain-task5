require("dotenv").config();

const express = require("express");
const nodemailer = require("nodemailer");
const path = require("path");
const ejs = require("ejs");
const passport = require("passport");
const cookieSession = require("cookie-session");
const Razorpay = require("razorpay");
const cors = require("cors");
const Register=require("./models/register");
const { nextTick } = require("process");
const { updateMany, updateOne, update } = require("./models/register");
const transpoter=require("./models/email");
const jwt=require("jsonwebtoken");
const cookieParser=require("cookie-parser");
require("./passport/passport-setup");
require("./db/connection");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(cookieParser());

const views_path = path.join(__dirname, "../views");
const static_path = path.join(__dirname, "../public");

app.use(passport.initialize());

app.use(
  cookieSession({
    name: "interactive-session",
    keys: ["key1", "key2"],
  })
);

app.use(passport.session());
app.use(express.static(static_path));
app.set("view engine", "ejs");
app.set("views", views_path);

function loggedIn(req, res, next) {
  if (req.user) {
      next();
  } else {
      res.redirect('/google');
  }
}

app.get("/", (req, res) => {
  try {
    res.render("landingpage");
  } catch (error) {
    res.status(400).json({ message: "Something Went Wrong" });
  }
});

app.get("/registeration",loggedIn,(req, res,next) => {
  try {
    res.render("register", {
      email: req.user.emails[0].value,
      name: req.user.displayName,
      pic: req.user.photos[0].value,
    });
  } catch (error) {
    res.status(400).json({ message: "Something Went Wrong" });
  }
});

app.get("/google",passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get("/google/callback",passport.authenticate("google", { failureRedirect: "/failed" }),
  (req, res) => {
    const getEmail = req.user.emails[0].value;
    const emailDomain = getEmail.split("@");

    if (emailDomain[1] === "akgec.ac.in") {
      res.redirect("/registeration");
    } else {
      res.status(422).json({ message: "Invalid User Email,Login with College ID" });
    }
  }
);

app.post("/add/registered/user",loggedIn,async (req,res,next)=>{
  try {
    const userExist=await Register.findOne({email:req.body.email});
    
    if(!userExist){
      const registerUser=new Register({
        email:req.body.email,
        userName:req.body.uname,
        pictureURL:req.body.pname,
        branch:req.body.bname,
        year:req.body.yname,
        student_number:req.body.sno,
        student_roll:req.body.srno,
        question:req.body.qbox,
      })
      const userData=await registerUser.save();
      const token= await registerUser.generateAuthtoken();
      res.cookie("email",token);
      console.log(userData);
      console.log("registered Successfully");
      
      let info=await transpoter.sendMail({
        from:process.env.EMAIL_FROM,
        to:[req.body.email,`${process.env.EMAIL_USER}`],
        subject:"Registered Successfully",
        html:`email:${req.body.email} <br>
        userName:${req.body.uname}, <br>
        pictureURL:${req.body.pname}, <br>
        branch:${req.body.bname}, <br>
        year:${req.body.yname}, <br>
        student_number:${req.body.sno},<br>
        student_roll:${req.body.srno},<br>
        question:${req.body.qbox},`,
      })
      console.log("email send");
      res.redirect("/dopayment");
    }
    else if(userExist.payment_status==true){
      res.redirect("/paymentsuccess");
    }
    else{
      console.log("already registered")
      const token= await userExist.generateAuthtoken();
      res.cookie("email",token);
      res.redirect("/dopayment");
    }
  } catch (e) {
    console.log(e);
    res.status(400).json({message:"Please provide all the neccesary details"});
  }


})

app.get("/dopayment",loggedIn,(req,res,next)=>{
  try {
    res.render("dopayment",{
      email:req.body.email,
    });
  } catch (error) {
    console.log(error);
  }
})

app.post("/payments",loggedIn, async (req, res,next) => {
  try {
    let instance = new Razorpay({
      key_id: process.env.KEY_ID,
      key_secret: process.env.KEY_SECRET,
    });

    let order = await instance.orders.create({
      amount: 2000,
      currency: "INR",
    });
    res.status(201).json({ success: true, order });
  } catch (e) {
    console.log(e);
  }
});

app.post("/paymentverification",loggedIn,async (req,res,next)=>{

  verifyytoken=req.cookies.email;
  const userver=await jwt.verify(verifyytoken,"mynameisprakhar");

  const update_details=userver.email;


    const paymentID=req.body.razorpay_payment_id;
    const orderID=req.body.razorpay_order_id;
    const signatureID=req.body.razorpay_signature;

    let body =orderID +"|" +paymentID;

  let crypto = require("crypto");
  let expectedSignature = crypto.createHmac("sha256", process.env.KEY_SECRET).update(body.toString()).digest("hex");
  console.log("sign received ", signatureID);
  console.log("sign generated ", expectedSignature);
  var response = " Signature is false" ;
  if (expectedSignature === signatureID){
    const newdata=await Register.updateOne({email:update_details},{
      payment_status:"true",
      order_id:orderID,
      payment_id:paymentID,
    });

    let info=await transpoter.sendMail({
      from:process.env.EMAIL_FROM,
      to:[update_details,`${process.env.EMAIL_USER}`],
      subject:"Pyament Successfully",
      html:"<h1>Payment Successfully</h1>"
    })
    res.redirect("/paymentsuccess");
  }else{
    res.status(404).json({message:"Payment failure"});
  }
});



app.get("/paymentsuccess",(req,res)=>{
  try {

    res.render("paymentsuccess");

    
  } catch (error) {
    res.statusCode(400).json({mesaage:"something went wrong"});
  }
})

app.listen(process.env.PORT || 3000, () => {
  console.log("connected");
});
