const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');

const User = require('../models/user');
const Post = require('../models/post');
const file = require('../util/file');

module.exports = {
    createUser: async function({ userInput }, req) {
        // const email = args.userInput.email;
        const errors = [];
        if (!validator.isEmail(userInput.email)) {
            errors.push({ message: 'Email is invalid!' });
        }
        if (validator.isEmpty(userInput.password) ||  !validator.isLength(userInput.password, { min: 5 })) {
            errors.push({ message: 'Password is invalid!' });
        }
        if (errors.length > 0) {
            const error = new Error('Invalid data entered!');
            error.data = errors;
            error.code = 422;
            throw error;
        }
        const existingUser = await User.findOne({ email: userInput.email });
        if (existingUser) {
            const error = new Error('Email already exists!');
            error.code = 422;
            throw error;
        }
        const hashedPassword = await bcrypt.hash(userInput.password, 12);
        const user = new User({
            name: userInput.name,
            // status: 'I am new!',
            email: userInput.email,
            password: hashedPassword
        });
        const createdUser = await user.save();
        return { ...createdUser._doc, _id: createdUser._id.toString() };
    },

    signIn: async function( {email, password }, req) {
        const user = await User.findOne({ email });
        if (!user) {
            const error = new Error('Email not found!');
            error.code = 404;
            throw error;
        }
        const isEqual = await bcrypt.compare(password, user.password);
        if (!isEqual) {
            const error = new Error('The password is incorrect!');
            error.code = 401;
            throw error;
        }
        const token = jwt.sign({ 
            email: user.email, 
            userId: user._id.toString()  
            },
            'the-secret-parameter',
            { expiresIn: '1h' }
        );
        return { token, userId: user._id.toString() };
    },

    createPost: async function( {postInput}, req) {
        if (!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.code = 401;
            throw error;
        }
        const errors = [];
        if (!validator.isLength(postInput.title, { min: 5 })) {
            errors.push({ message: 'Title is too short!'});
        }
        // if (validator.isEmpty(postInput.imageUrl)) {
        //     errors.push({ message: 'You have not picked an image!' });
        // }
        if (!validator.isLength(postInput.content, { min: 5 })) {
            errors.push({ message: 'Content is too short!'});
        }
        if (errors.length > 0) {
            const error = new Error('Invalid data entered!');
            error.data = errors;
            error.code = 422;
            throw error;
        }
        const user = await User.findById(req.userId);
        if (!user) {
            const error = new Error('Invalid user!');
            error.code = 401;
            throw error;
        }
        const post = new Post({
            title: postInput.title,
            imageUrl: postInput.imageUrl,
            content: postInput.content,
            creator: user
        });
        const createdPost = await post.save();
        user.posts.push(createdPost);
        await user.save();
        return { 
            ...createdPost._doc, 
            _id: createdPost._id.toString(), 
            createdAt: createdPost.createdAt.toISOString(), 
            updatedAt: createdPost.updatedAt.toISOString() 
        }
    },

    getPosts: async function({ page }, req) {
        if (!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.code = 401;
            throw error;
        }
        if (!page) {
            page = 1;
        }
        const perPage = 2;
        const totalPosts = await Post.find().countDocuments();
        const posts = await Post.find().sort({ createdAt: -1 }).skip( (page - 1) * page ).limit(perPage).populate('creator');
        return { 
            posts: posts.map(i => {
                return {
                    ...i._doc, 
                    _id: i._id.toString(), 
                    createdAt: i.createdAt.toISOString(), 
                    updatedAt: i.updatedAt.toISOString()
                }
            }), 
        totalPosts 
        }
    },

    getPostById: async function({ id }, req) {
        console.log(req);
        if (!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.code = 401;
            throw error;
        }
        const post = await Post.findById(id).populate('creator');
        if (!post) {
            const error = new Error('Post not found!');
            error.code = 404;
            throw error;
        }
        return { 
            ...post._doc, 
            _id: post._id.toString(), 
            createdAt: post.createdAt.toISOString(), 
            updatedAt: post.updatedAt.toISOString() 
        }
    },

    updatePost: async function( { postInput, id }, req) {
        if (!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.code = 401;
            throw error;
        }
        const post = await Post.findById(id).populate('creator');
        if (!post) {
            const error = new Error('Post not found!');
            error.code = 404;
            throw error;
        }
        if (req.userId.toString() !== post.creator._id.toString()) {
            const error = new Error('Not authorizated!');
            error.code = 403;
            throw error;
        }
        const errors = [];
        if (!validator.isLength(postInput.title, { min: 5 })) {
            errors.push({ message: 'Title is too short!'});
        }
        // if (validator.isEmpty(postInput.imageUrl)) {
        //     errors.push({ message: 'You have not picked an image!' });
        // }
        if (!validator.isLength(postInput.content, { min: 5 })) {
            errors.push({ message: 'Content is too short!'});
        }
        if (errors.length > 0) {
            const error = new Error('Invalid data entered!');
            error.data = errors;
            error.code = 422;
            throw error;
        }
        post.title = postInput.title;
        if (postInput.imageUrl !== 'undefined') {
            post.imageUrl = postInput.imageUrl;
        }
        post.content = postInput.content;
        const updatedPost = await post.save();
        return { 
            ...updatedPost._doc, 
            _id: updatedPost._id.toString(), 
            createdAt: updatedPost.createdAt.toISOString(), 
            updatedAt: updatedPost.updatedAt.toISOString() 
        }
    },

    deletePost: async function( { id }, req) {
        if (!req.isAuth) {
            const error = new Error('Not authorizated!');
            error.code = 401;
            throw error;
        }
        const post = await Post.findById(id);
        if (!post) {
            const error = new Error('Post not found!');
            error.code = 404;
            throw error;
        }
        if (req.userId.toString() !== post.creator.toString()) {
            const error = new Error('Not authorizated!');
            error.code = 401;
            throw error;
        }
        const user = await User.findById(req.userId);
        if (!user) {
            const error = new Error('User not found!');
            error.code = 404;
            throw error;
        }
        await Post.findOneAndDelete({ _id: post._id });
        file.clearImage(post.imageUrl);
        user.posts.pull(id);
        await user.save();
        return true;
    },

    getUser: async function(args, req) {
        if (!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.code = 401;
            throw error;
        }
        const user = await User.findById(req.userId);
        if (!user) {
            const error = new Error('User not found!');
            error.code = 404;
            throw error;
        }
        return {...user._doc, _id: user._id.toString() }
    },

    updateStatus: async function({ status }, req) {
        if (!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.code = 401;
            throw error;
        }
        const user = await User.findById(req.userId);
        if (!user) {
            const error = new Error('User not found!');
            error.code = 404;
            throw error;
        }
        user.status = status;
        await user.save();
        return {...user._doc, _id: user._id.toString() }
    }
}