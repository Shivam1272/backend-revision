import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
  const user = req.user.id;
  const { content } = req.body;
  if (!isValidObjectId(user)) throw new ApiError(401, "Invalid user ID");
  if (!content) {
    throw new ApiError(400, "Content field required");
  }
  //TODO: create tweet
  try {
    const userData = await User.findById(user);
    if (!userData) throw new ApiError(404, "User not found!");
    const tweet = await Tweet.create({
      owner: userData._id,
      content: content,
    });
    if (!tweet) {
      throw new ApiError(403, "Unable to store tweet in DB");
    }
    return res
      .status(200)
      .json(new ApiResponse(201, tweet, "Created a new tweet!"));
  } catch (error) {
    throw new ApiError(500, error.message || "Unable to store tweet..");
  }
});

const getUserTweets = asyncHandler(async (req, res) => {
  // TODO: get user tweets
  const { userId } = req.params;
  console.log(userId);
  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user id");
  }
  try {
    const data = await Tweet.find({ owner: userId });
    if (!data.length) {
      throw new ApiError(404, "No tweet from this user");
    }
    console.log(data);
    return res.status(201).json(new ApiResponse(201, data, "User tweets"));
  } catch (error) {
    throw new ApiError(
      500,
      error.message || "Unable to retrive tweet please try again..."
    );
  }
});

const updateTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const { content } = req.body;
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet ID");
  }
  if (!content) {
    throw new ApiError(400, "Content is missing");
  }
  //TODO: update tweet
  try {
    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
      throw new ApiError(404, "Tweet not found!");
    }
    if (tweet.owner.toString() !== req.user._id.toString()) {
      throw new ApiError(
        403,
        "You do not have permission to perform this action on this tweet."
      );
    }
    tweet.set({ content });
    await tweet.save();
    return res
      .status(200)
      .json(new ApiResponse(200, tweet, "Updated successfully"));
  } catch (error) {
    throw new ApiError(
      500,
      error.message || "Unable to update tweet please try again..."
    );
  }
});

const deleteTweet = asyncHandler(async (req, res) => {
  //TODO: delete tweet
  const { tweetId } = req.params;
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet ID");
  }
  try {
    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
      throw new ApiError(404, "Tweet not found!");
    }
    if (tweet.owner.toString() !== req.user._id.toString()) {
      throw new ApiError(
        403,
        "You do not have permission to perform this action on this tweet."
      );
    }
    await Tweet.findByIdAndDelete(tweetId);
    return res
      .status(200)
      .json(new ApiResponse(200, null, "deleted successfully"));
  } catch (error) {
    throw new ApiError(
      500,
      error.message || "Unable to update tweet please try again..."
    );
  }
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
