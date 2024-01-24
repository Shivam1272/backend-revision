import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const userId = req.user.id;
  // TODO: toggle subscription
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid Channel ID");
  }
  try {
    let channel = await User.findById(channelId);
    if (!channel) {
      throw new ApiError(404, "Channel not found");
    }
    let subscribed, unsubscribed;
    const alreadySubscribed = await Subscription.findOne({
      subscriber: userId,
      channel: channelId,
    });
    if (alreadySubscribed) {
      unsubscribed = await Subscription.findByIdAndDelete(
        alreadySubscribed._id
      );
      if (!unsubscribed) {
        throw new ApiError(400, "Failed to remove existing subscription");
      }
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            unsubscribed,
            "Unfollowed the channel successfully"
          )
        );
    } else {
      subscribed = await Subscription.create({
        subscriber: userId,
        channel: channelId,
      });
      if (!subscribed) {
        throw new ApiError(500, "Server error while adding a subscription");
      }
      return res
        .status(201)
        .json(
          new ApiResponse(201, subscribed, "Followed the channel successfully")
        );
    }
  } catch (error) {
    throw new ApiError(
      500,
      error?.message || "Error while toggleing the Subscription "
    );
  }
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid Channel ID provided");
  }
  try {
    const subscribers = await Subscription.aggregate([
      {
        $match: {
          channel: new mongoose.Types.ObjectId(channelId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "subscriber",
          foreignField: "_id",
          as: "user_info",
        },
      },
      {
        $project: {
          user_info: {
            username: 1,
            fullName: 1,
            avatar: 1,
          },
        },
      },
    ]);
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          subscribers.length === 0 ? null : subscribers,
          subscribers.length === 0
            ? "No Subscriber for this channel"
            : "Successfully retrive all subscribers"
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      error?.message || "Error Occured while retriving subscribers list"
    );
  }
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;
  if (!isValidObjectId(subscriberId)) {
    throw new ApiError(400, "Invalid User ID");
  }
  try {
    const subscribedChannels = await Subscription.aggregate([
      {
        $match: {
          subscriber: new mongoose.Types.ObjectId(subscriberId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "channel",
          foreignField: "_id",
          as: "info",
        },
      },
      {
        $project: {
          info: {
            username: 1,
            avatar: 1,
          },
        },
      },
    ]);
    // send response
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          subscribedChannels.length === 0 ? null : subscribedChannels,
          subscribedChannels.length === 0
            ? "User is not subscribed any channel"
            : "List of Channel subscribed by user"
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      error.message ||
        "Error Occured while retreving list of channle subscribed by user"
    );
  }
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
