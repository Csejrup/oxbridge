import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {NotFound} from 'express-http-custom-error';
import {Request, Response} from 'express';
import User, {IUser, Roles} from '../models/user';
import {getJwtSecret} from '../config/config';

// Retrieve all users
const findAll = async (req: Request, res: Response) => {
  const users: IUser[] = await User.find().exec();
  res.status(200).json(users);
};

// Find a single user with the specified email
const findOne = async (req: Request, res: Response) => {
  const user = await User.findOne({email: req.params.email}).exec();
  if (!user) {
    throw new NotFound(null, 'No user with that email exists.');
  }
  res.status(200).json(user);
};

// Update a user with the specified email
const update = async (req: Request, res: Response) => {
  const user = new User(req.body);
  user.role = req.body.role;
  const filter = {email: user.email};
  const updatedUser = await User.findOneAndUpdate(filter, user);
  if (!user) {
    throw new NotFound('User not found with id ' + req.params.email);
  }
  res.status(202).json(updatedUser);
};

// Delete a user with the specified email
const remove = async (req: Request, res: Response) => {
  const filter = {email: req.params.email};
  const deletedUser: IUser | null = await User.findOneAndDelete(filter);
  if (!deletedUser) throw new Error('No user found with email ' + filter);

  res.status(202).json(deletedUser);
};

// Register a new admin user and return token
const registerAdmin = async (req: Request, res: Response) => {
  // Creating the new user
  const user = new User(req.body);
  user.role = Roles.Admin;

  const savedUser = await user.save();
  if (!savedUser) throw new Error('User not found.');

  const payload = {id: user.email, isAdmin: true};
  const token = jwt.sign(payload, getJwtSecret(), {expiresIn: 86400});
  res.status(201).send({auth: true, token: token});
};

// Register a new user and return token
const register = async (req: Request, res: Response) => {
  // Creating the user
  const newUser: IUser = new User(req.body);
  const savedUser = await newUser.save();
  if (!savedUser) throw new Error('Failed to save user.');
  // returning a token
  const token = jwt.sign(savedUser.toJSON(),
      getJwtSecret(), {expiresIn: 86400});
  res.status(201).send({auth: true, token: token});
};

// Check login info and return login status
const login = async (req: Request, res: Response) => {
  // Find the user and validate the password
  const filter = {email: req.body.email};
  const user = await User.findOne(filter);
  if (!user) throw new NotFound('No user exist with provided credentials.');
  const valid = bcrypt.compareSync(req.body.password, user.password);
  if (!valid) throw new Error('Invalid password.');
  // returning a token
  const token = jwt.sign(user.toJSON(),
      getJwtSecret(), {expiresIn: 86400});
  res.status(200).send({user, token});
};

export default {
  findAll,
  findOne,
  update,
  remove,
  registerAdmin,
  register,
  login,
};
