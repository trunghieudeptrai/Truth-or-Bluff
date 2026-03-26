const { MongoClient } = require('mongodb');

// Vercel serverless function (API endpoint)
module.exports = async (req, res) => {
  // Lấy chuỗi kết nối từ cấu hình môi trường Vercel hoặc file .env cục bộ
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    return res.status(500).json({ 
      success: false, 
      error: 'Chưa cấu hình biến môi trường MONGODB_URI trên Vercel.' 
    });
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    
    // Gửi lệnh ping để kiểm tra kết nối với server MongoDB
    await client.db("admin").command({ ping: 1 });
    
    return res.status(200).json({
      success: true,
      message: '🎉 Kết nối MongoDB thành công mỹ mãn!'
    });
  } catch (error) {
    console.error('Lỗi kết nối MongoDB:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi kết nối MongoDB',
      error: error.message
    });
  } finally {
    // Đóng kết nối sau khi request hoàn tất (thực tế nếu có nhiều query nên giữ connection pool lại)
    await client.close();
  }
};
