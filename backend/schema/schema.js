const graphql = require("graphql");
const _ = require("lodash");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require("../models/user");
const Post = require("../models/post");
const { formatDate } = require("../utils");

const {
  GraphQLObjectType,
  GraphQLID,
  GraphQLString,
  GraphQLList,
  GraphQLInt,
  GraphQLSchema,
  GraphQLNonNull,
} = graphql;

// types
const UserType = new GraphQLObjectType({
  name: "User",
  description: "User Type",
  fields: () => ({
    id: { type: GraphQLID },
    username: { type: GraphQLString },
    email: { type: GraphQLString },
    password: { type: GraphQLString },
    createDate: { type: GraphQLString },
    token: { type: GraphQLString },
    posts: {
      type: GraphQLList(PostType),
      resolve(parent, args) {
        return Post.find({ username: parent.username });
      },
    },
  }),
});

const PostType = new GraphQLObjectType({
  name: "Post",
  description: "Post Type",
  fields: () => ({
    id: { type: GraphQLID },
    title: { type: GraphQLString },
    content: { type: GraphQLString },
    image: { type: GraphQLString },
    username: { type: GraphQLString },
    // user: {
    //   type: UserType,
    //   resolve(parent, args) {
    //     return User.findById(parent.userID);
    //   },
    // },
  }),
});

// root query
const RootQuery = new GraphQLObjectType({
  name: "RootQueryType",
  description: "Root Query",
  fields: {
    user: {
      type: UserType,
      args: {
        username: {
          type: GraphQLString,
        },
      },
      resolve(parent, args) {
        return User.findOne({ username: args.username });
      },
    },
    users: {
      type: new GraphQLList(UserType),
      resolve(parent, args) {
        return User.find();
      },
    },
    post: {
      type: PostType,
      args: {
        id: { type: GraphQLID },
      },
      resolve(parent, args) {
        return Post.findById(args.id);
      },
    },
    userPosts: {
      type: new GraphQLList(PostType),
      args: {
        username: {
          type: GraphQLString,
        },
      },
      resolve(parent, args) {
        console.log({ parent });
        console.log({ args });
        return Post.find({ username: args.username });
      },
    },
    posts: {
      type: new GraphQLList(PostType),
      resolve(parent, args) {
        return Post.find();
      },
    },
  },
});

// mutations
const Mutation = new GraphQLObjectType({
  name: "Mutation",
  fields: {
    createUser: {
      type: UserType,
      args: {
        username: { type: new GraphQLNonNull(GraphQLString) },
        email: { type: new GraphQLNonNull(GraphQLString) },
        password: { type: new GraphQLNonNull(GraphQLString) },
      },
      async resolve(parent, args) {
        const hash = await bcrypt.hash(args.password, 12);
        const user = new User({
          username: args.username,
          email: args.email,
          password: hash,
          createDate: formatDate(new Date().toISOString()),
        });
        console.log(user);

        const res = await user.save();

        console.log(res);

        const token = generateToken(res);
        return {
          ...res._doc,
          id: res._id,
          token,
        };
      },
    },
    loginUser: {
      type: UserType,
      args: {
        username: { type: GraphQLString },
        password: { type: GraphQLString },
      },
      async resolve(parent, args) {
        const user = await User.findOne({ username: args.username });

        if (!user) {
          throw new Error("no user with that username");
        }

        const match = await bcrypt.compare(args.password, user.password);

        if (!match) {
          throw new Error("passwords do not match");
        }

        if (match && user) {
          const token = generateToken(user);
          console.log("login", user);
          return {
            ...user._doc,
            id: user._id,
            token,
          };
        }
      },
    },
    updateUser: {
      type: UserType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        username: { type: GraphQLString },
        email: { type: GraphQLString },
        password: { type: GraphQLString },
      },
      resolve(parent, args) {
        return User.findByIdAndUpdate(
          args.id,
          {
            $set: {
              username: args.username,
              email: args.email,
              password: args.password,
            },
          },
          { new: true }
        );
      },
    },
    createPost: {
      type: PostType,
      args: {
        title: { type: new GraphQLNonNull(GraphQLString) },
        content: { type: new GraphQLNonNull(GraphQLString) },
        image: { type: GraphQLString },
        username: { type: GraphQLString },
      },
      resolve(parent, args, req) {
        if (!req.isAuth) {
          throw new Error("Unauthenticated!");
        }

        const post = new Post({
          title: args.title,
          content: args.content,
          image: args.image,
          username: args.username,
        });

        console.log(post);
        return post.save();
      },
    },
    updatePost: {
      type: PostType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        title: { type: GraphQLString },
        content: { type: GraphQLString },
        image: { type: GraphQLString },
      },
      resolve(parent, args) {
        return Post.findByIdAndUpdate(
          args.id,
          {
            $set: {
              title: args.title,
              content: args.content,
              image: args.image,
            },
          },
          { new: true }
        );
      },
    },
    deletePost: {
      type: PostType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
      },
      resolve(parent, args) {
        const deletedPost = Post.findByIdAndDelete(args.id).exec();

        if (!deletedPost) {
          throw new "Error"();
        }
        return deletedPost;
      },
    },
  },
});

module.exports = new GraphQLSchema({
  query: RootQuery,
  mutation: Mutation,
});

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
    },
    process.env.SECRET_KEY,
    { expiresIn: "1h" }
  );
};
