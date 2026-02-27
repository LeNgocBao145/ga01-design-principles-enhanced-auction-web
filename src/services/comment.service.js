import * as productCommentModel from "../models/productComment.model.js";
class CommentService {
   async getPaginatedCommentsWithReplies(productId, page) {
    const commentsPerPage = 2;
    const offset = (page - 1) * commentsPerPage;

    const [comments, totalComments] = await Promise.all([
      productCommentModel.getCommentsByProductId(productId, commentsPerPage, offset),
      productCommentModel.countCommentsByProductId(productId)
    ]);

    if (comments.length > 0) {
      const commentIds = comments.map(c => c.id);
      const allReplies = await productCommentModel.getRepliesByCommentIds(commentIds);
      
      const repliesMap = new Map();
      allReplies.forEach(reply => {
        if (!repliesMap.has(reply.parent_id)) repliesMap.set(reply.parent_id, []);
        repliesMap.get(reply.parent_id).push(reply);
      });
      
      comments.forEach(comment => {
        comment.replies = repliesMap.get(comment.id) || [];
      });
    }

    return {
      comments,
      totalComments,
      totalPages: Math.ceil(totalComments / commentsPerPage)
    };
  }

  async createComment(productId, userId, content, parentId) {
    if (!content || content.trim().length === 0) {
      throw new Error("Comment cannot be empty");
    }

    const cleanContent = content.trim();
    const cleanParentId = parentId || null;

    // Lưu vào DB
    await productCommentModel.createComment(
      productId,
      userId,
      cleanContent,
      cleanParentId
    );

    return { productId, userId, content: cleanContent, parentId: cleanParentId };
  }
}

export default new CommentService()