const connectDB = require('../lib/mongodb');

// Vercel serverless function (API endpoint)
module.exports = async (req, res) => {
  try {
    // Gọi hàm kết nối đã được cache
    await connectDB();
    
    return res.status(200).json({
      success: true,
      message: '🎉 Kết nối MongoDB qua Mongoose (Cached) thành công mỹ mãn!'
    });
  } catch (error) {
    console.error('Lỗi kết nối MongoDB:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi kết nối MongoDB',
      error: error.message
    });
  }
};
