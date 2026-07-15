import jwt from "jsonwebtoken";
import pool from '../database.js';

let commentIdColumnCache = null;

const getCommentIdColumn = async () => {
  if (commentIdColumnCache) {
    return commentIdColumnCache;
  }

  const columnResult = await pool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'comment'
    `
  );

  const availableColumns = columnResult.rows.map((row) => row.column_name);
  const preferredColumns = ['commentid', 'comment_id', 'id'];

  const match = preferredColumns.find((candidate) =>
    availableColumns.some((column) => column.toLowerCase() === candidate)
  );

  if (!match) {
    throw new Error('Unable to resolve comment ID column in comment table');
  }

  commentIdColumnCache = availableColumns.find((column) => column.toLowerCase() === match);
  return commentIdColumnCache;
};

const userAuth = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token || !token.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized request" });
  }

  const tokenValue = token.split(" ")[1];

  try {
    const decoded = jwt.verify(tokenValue, process.env.JWT_SECRET); 

    if (decoded.tokenType === 'preauth') {
      return res.status(401).json({ message: "MFA verification required" });
    }

    const email = decoded.email;
    const result = await pool.query(
        "SELECT email, role FROM users WHERE email = $1",
        [email]
    );
    const user = result.rows[0];

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "No user found with this email" });
    }

    // Set both for backward compatibility and new consistency
    req.userEmail = user.email;
    req.userRole = user.role;
    // Add this for private spaces consistency
    req.user = {
        email: user.email,
        role: user.role
    };

    next();
  } catch (err) {
    console.error("Token verification failed");
    return res.status(401).json({ message: "Invalid token" });
  }
};

const verifyAdmin = (req, res, next) => {
  if (req.userRole !== 'Admin') {
    return res.status(403).json({ message: 'Admin role required' });
  }
  next();
};

const verifyAdminOrOwner = async (req, res, next) => {
  const postId = Number(req.params.postId);
  
  if (!req.params.postId || isNaN(postId)) {
    return res.status(400).json({ message: "Invalid post ID" });
  }
  
  console.log("Post ID:", postId);
  console.log("Request path:", req.path);
  console.log("User role:", req.userRole);

  try {
    const result = await pool.query('SELECT email FROM post WHERE postid = $1', [postId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Post not found" });
    }

    const post = result.rows[0];
    if (req.userRole === 'Admin' || post.email === req.userEmail) {
      return next();
    } else {
      return res.status(403).json({ message: "You are not authorized to delete this post" });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error"
    });
  }
};

const verifyAdminOrCommentOwner = async (req, res, next) => {
  const commentId = req.params.commentId || req.body?.commentId || req.query?.commentId;

  if (!req.params.commentId || isNaN(commentId)) {
    return res.status(400).json({ message: "Invalid comment ID" });
  }

  console.log("Comment ID from params:", commentId);

  if (!commentId) {
    return res.status(400).json({ message: "commentId is required" });
  }

  try {
    const commentIdColumn = await getCommentIdColumn();
    const result = await pool.query(
    `SELECT email FROM comment WHERE "${commentIdColumn}" = $1`,
    [commentId]
);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const comment = result.rows[0];

    if (req.userRole === 'Admin' || comment.email === req.userEmail) {
      return next();
    } else {
      return res.status(403).json({ message: "You are not authorized to delete this comment" });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error"
    });
  }
};

export { userAuth, verifyAdmin, verifyAdminOrOwner, verifyAdminOrCommentOwner };

