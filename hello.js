import { MongoClient } from "mongodb";

// Safe connection string (with encoded password)
const uri = "mongodb+srv://legalmentors:Desirockstar%407@cluster0.bzh4k13.mongodb.net/riseupcreator?retryWrites=true&w=majority&authSource=admin";
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const db = client.db("riseupcreator");
    const merch = db.collection("merch");

    // New Cloudinary image set
    const imageSet = [
      "https://res.cloudinary.com/ddivraeui/image/upload/v1760462742/ruc/images/merch-1760462741864-0.webp",
      "https://res.cloudinary.com/ddivraeui/image/upload/v1760462743/ruc/images/merch-1760462743050-1.jpg",
      "https://res.cloudinary.com/ddivraeui/image/upload/v1760462743/ruc/images/merch-1760462743758-2.jpg",
      "https://res.cloudinary.com/ddivraeui/image/upload/v1760462744/ruc/images/merch-1760462744392-3.jpg",
      "https://res.cloudinary.com/ddivraeui/image/upload/v1760462745/ruc/images/merch-1760462745092-4.jpg"
    ];

    // Create 5 merch items, each rotating the first image
    const sampleMerch = [
      {
        name: "Taylor Merch T-Shirt",
        description: "Exclusive premium T-shirt for Taylor fans.",
        artistId: "68ee5d271a0930456e7753ab",
        artistName: "Sajag Gupta",
        category: "T-Shirts",
        price: 1000,
        stock: 10,
        images: [imageSet[0], ...imageSet.filter((_, i) => i !== 0)],
        sizes: ["S", "M", "L", "XL", "XXL"],
        colors: ["Red"],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Fearless Hoodie",
        description: "Soft cotton hoodie inspired by the Fearless album.",
        artistId: "68ee5d271a0930456e7753ab",
        artistName: "Sajag Gupta",
        category: "Hoodies",
        price: 1800,
        stock: 15,
        images: [imageSet[1], ...imageSet.filter((_, i) => i !== 1)],
        sizes: ["S", "M", "L", "XL"],
        colors: ["Black", "White"],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Swiftie Cap",
        description: "Classic cap with embroidered Swiftie logo — perfect for concerts!",
        artistId: "68ee5d271a0930456e7753ab",
        artistName: "Sajag Gupta",
        category: "Accessories",
        price: 700,
        stock: 25,
        images: [imageSet[2], ...imageSet.filter((_, i) => i !== 2)],
        sizes: [],
        colors: ["Beige", "Navy Blue"],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Midnights Poster",
        description: "A high-quality printed poster featuring Taylor’s Midnights album art.",
        artistId: "68ee5d271a0930456e7753ab",
        artistName: "Sajag Gupta",
        category: "Posters",
        price: 500,
        stock: 40,
        images: [imageSet[3], ...imageSet.filter((_, i) => i !== 3)],
        sizes: ["A3", "A2"],
        colors: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Signature Mug",
        description: "Ceramic mug with Taylor’s autograph and motivational quote.",
        artistId: "68ee5d271a0930456e7753ab",
        artistName: "Sajag Gupta",
        category: "Collectibles",
        price: 600,
        stock: 30,
        images: [imageSet[4], ...imageSet.filter((_, i) => i !== 4)],
        sizes: [],
        colors: ["White"],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const result = await merch.insertMany(sampleMerch);
    console.log(`${result.insertedCount} merch items inserted successfully into riseupcreator.merch`);
  } catch (err) {
    console.error("Error inserting merch:", err);
  } finally {
    await client.close();
  }
}

run();
