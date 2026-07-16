import express from "express";
import { handleSocialLogin, handleLinkedInAuth, handleGoogleAuth } from "./socialAuth.js";
import { userAuth, verifyAdmin, verifyAdminOrOwner, verifyAdminOrCommentOwner } from './middleware/authMiddleware.js';
import {
  authRateLimiter,
  passwordResetConfirmRateLimiter,
  passwordResetRequestRateLimiter,
  usernameLookupRateLimiter,
  writeOperationRateLimiter
} from './middleware/rateLimiters.js';
import { upload } from "./fileManagement.js";
import {
  createNewPost,
  getAllApprovedPosts,
  getAllApprovedPostsByUser,
  getPendingPosts,
  getUserPosts,
  deletePost,
  createNewCommunityPost,
  getCommunityApprovedPosts,
  verifyUserLogin,
  registerNewUser,
  verifySignupCode,
  requestPasswordReset,
  confirmPasswordReset,
  getApprovedUsers,
  getPendingUsers,
  approveUser,
  deleteUser,
  createNewUser,
  fileUpload,
  //getSpecificUser,
  //promoteUser,
  updateUserInfo,
  getAllCommunities,
  joinCommunity,
  leaveCommunity,
  getUserCommunities,
  getCommunityName,
  searchUser,
  findUser,
  addComment,
  getComment,
  getCommentByCommentID,
  getCommentsByPostID,
  updateComment,
  deleteComment,
  createConversation,
  getConversations,
  sendMessage,
  getMessages,
  getLastMessage,
  getConversationDetails,
  updateConversationTitle,
  getUserInfo,
  checkIfFriended,
  friendUser,
  unfriendUser,
  getFriendsList,
  getPendingFriendRequests,
  getTest,
  createNewCommunity,
  getSentFriendRequests,
  changeColor,
  likePost,
  unlikePost,
  getPostLikes,
  checkLikedPost,
  muteUser,
  unmuteUser,
  getMuteList,
  checkIfMuted,
  blockUser,
  unblockUser,
  checkIfBlocked,
  createPrivateSpace,
  getUserPrivateSpaces,
  getPrivateSpaceDetails,
  inviteToPrivateSpace,
  acceptPrivateSpaceInvitation,
  getPendingInvitations,
  createPrivateSpacePost,
  getPrivateSpacePosts,
  addPrivateSpaceComment,
  getPrivateSpaceComments,
  getPrivateSpaceMembers,
  removePrivateSpaceMember,
  deletePrivateSpacePost,
  getInvitableUsers,
  searchInvitableUsers,
  dissolvePrivateSpace
} from "./dbLogic.js";

const router = express.Router();

// Test route for connectivity
router.get("/test", (req, res) => {
  res.status(200).json({ message: "Server is working!", timestamp: new Date().toISOString() });
});

// Authentication Routes (open)
router.post("/login", authRateLimiter, verifyUserLogin);
router.post("/register", registerNewUser);
// Completes signup only after user enters the emailed 6-digit code.
router.post("/register/verify", verifySignupCode);
router.post("/password-reset/request", passwordResetRequestRateLimiter, requestPasswordReset);
router.post("/password-reset/confirm", passwordResetConfirmRateLimiter, confirmPasswordReset);
router.post("/api/auth/social", authRateLimiter, handleSocialLogin);
router.post("/api/auth/google", authRateLimiter, handleGoogleAuth);
router.post("/api/auth/linkedin", authRateLimiter, handleLinkedInAuth);
// Protected user routes
router.patch("/updateUserInfo", userAuth, writeOperationRateLimiter, updateUserInfo);

// User Management Routes
router.post("/createNewUser", userAuth, verifyAdmin, writeOperationRateLimiter, createNewUser);
router.get("/getApprovedUsers", userAuth, verifyAdmin, getApprovedUsers);
router.get("/getPendingUsers", userAuth, verifyAdmin, getPendingUsers);
router.post("/approveUser", userAuth, verifyAdmin, writeOperationRateLimiter, approveUser);
router.post("/changeUserColor", userAuth, writeOperationRateLimiter, changeColor);
router.delete("/deleteUser/:email", userAuth, verifyAdmin, writeOperationRateLimiter, deleteUser);
// router.get("/getSpecificUser", ...);
// router.post("/promoteUser", ...);

// Post Routes
router.post("/fileUpload", userAuth, writeOperationRateLimiter, upload.single('file'), fileUpload);
router.post("/createNewPost", userAuth, writeOperationRateLimiter, createNewPost);
router.get("/getAllApprovedPosts", getAllApprovedPosts);
router.get("/getAllApprovedPostsByUser/:username", getAllApprovedPostsByUser);
router.get("/getPendingPosts", getPendingPosts);
router.get("/getUserPosts", getUserPosts);
router.delete("/deletePost/:postId", userAuth, verifyAdminOrOwner, writeOperationRateLimiter, deletePost);


// Community Post Routes
router.post("/createNewCommunityPost", userAuth, writeOperationRateLimiter, createNewCommunityPost);
router.get("/getCommunityApprovedPosts", getCommunityApprovedPosts);

// Community Management Routes
router.post("/createNewCommunity", userAuth, writeOperationRateLimiter, createNewCommunity); // Assuming this was implemented as per dbLogic.js
router.get("/getAllCommunities", getAllCommunities);
router.post("/joinCommunity", userAuth, writeOperationRateLimiter, joinCommunity);
router.delete("/leaveCommunity", userAuth, writeOperationRateLimiter, leaveCommunity);
router.get("/getUserCommunities", getUserCommunities);
router.get("/getCommunityName", getCommunityName);

// User Search Routes
router.get("/searchUser", usernameLookupRateLimiter, userAuth, searchUser);
router.get("/findUser", usernameLookupRateLimiter, userAuth, findUser);

// Comment Routes
router.post("/addComment", userAuth, writeOperationRateLimiter, addComment);
router.get("/getComment", getComment);
router.get("/getCommentByCommentID", getCommentByCommentID);
router.get("/getCommentsByPostID", getCommentsByPostID);
router.put("/updateComment", userAuth, writeOperationRateLimiter, updateComment);
router.delete("/deleteComment/:commentId", userAuth, verifyAdminOrCommentOwner, writeOperationRateLimiter, deleteComment);
router.delete("/deleteComment", userAuth, verifyAdminOrCommentOwner, writeOperationRateLimiter, deleteComment);

// Messaging Routes
router.post("/createConversation", userAuth, writeOperationRateLimiter, createConversation);
router.get("/getConversations", getConversations);
router.post("/sendMessage", userAuth, writeOperationRateLimiter, sendMessage);
router.get("/getMessages", getMessages);
router.get("/getLastMessage", getLastMessage);
router.get("/getConversationDetails", getConversationDetails);
router.post("/updateConversationTitle", userAuth, writeOperationRateLimiter, updateConversationTitle);

// Friend Routes
router.get("/getUserInfo", userAuth, getUserInfo);
router.get("/checkIfFriended", userAuth, checkIfFriended);
router.post("/friendUser", userAuth, friendUser);
router.delete("/unfriendUser", userAuth, unfriendUser);
router.get("/getFriendsList", userAuth, getFriendsList);
router.get("/getSentFriendRequests", userAuth, getSentFriendRequests);
router.get("/getPendingFriendRequests", userAuth, getPendingFriendRequests);

// Liking Post Routes
router.post("/likePost", userAuth, writeOperationRateLimiter, likePost);
router.post("/getPostLikes", getPostLikes);
router.post("/checkLikedPost", userAuth, checkLikedPost);
router.post("/unlikePost", userAuth, writeOperationRateLimiter, unlikePost);

// Muting Routes
router.post("/muteUser", userAuth, writeOperationRateLimiter, muteUser);
router.delete("/unmuteUser", userAuth, writeOperationRateLimiter, unmuteUser);
router.get("/getMuteList", userAuth, getMuteList);
router.get("/checkIfMuted", userAuth, checkIfMuted)

// Blocking Routes
router.post("/blockUser", userAuth, writeOperationRateLimiter, blockUser);
router.delete("/unblockUser", userAuth, writeOperationRateLimiter, unblockUser);
router.get("/checkIfBlocked", userAuth, checkIfBlocked);

// Private Spaces Routes
router.post("/createPrivateSpace", userAuth, writeOperationRateLimiter, createPrivateSpace);
router.get("/getUserPrivateSpaces", userAuth, getUserPrivateSpaces);
router.get("/getPrivateSpaceDetails/:spaceId", userAuth, getPrivateSpaceDetails);
router.post("/inviteToPrivateSpace/:spaceId", userAuth, writeOperationRateLimiter, inviteToPrivateSpace);
router.post("/acceptPrivateSpaceInvitation/:invitationId", userAuth, writeOperationRateLimiter, acceptPrivateSpaceInvitation);
router.get("/getPendingInvitations", userAuth, getPendingInvitations);
router.post("/createPrivateSpacePost/:spaceId", userAuth, writeOperationRateLimiter, createPrivateSpacePost);
router.get("/getPrivateSpacePosts/:spaceId", userAuth, getPrivateSpacePosts);
router.post("/addPrivateSpaceComment/:postId", userAuth, writeOperationRateLimiter, addPrivateSpaceComment);
router.get("/getPrivateSpaceComments/:postId", userAuth, getPrivateSpaceComments);
router.get("/getPrivateSpaceMembers/:spaceId", userAuth, getPrivateSpaceMembers);
router.delete("/removePrivateSpaceMember/:spaceId/:memberEmail", userAuth, writeOperationRateLimiter, removePrivateSpaceMember);
router.delete("/deletePrivateSpacePost/:postId", userAuth, writeOperationRateLimiter, deletePrivateSpacePost);
router.get("/getInvitableUsers/:spaceId", userAuth, getInvitableUsers);
router.get("/searchInvitableUsers/:spaceId", userAuth, searchInvitableUsers);
router.delete("/dissolvePrivateSpace/:spaceId", userAuth, writeOperationRateLimiter, dissolvePrivateSpace);

// Test Route
router.get("/getTest", getTest);

export default router;
