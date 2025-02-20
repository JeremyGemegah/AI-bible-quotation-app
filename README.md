# AI Bible Quotation App

## Overview
This AI-powered Bible Quotation App automatically detects and displays Bible scriptures mentioned in speech. It streams audio to Speechmatics AI for real-time transcription, sends the transcribed text to Google Gemini AI to extract scripture references, and then queries a Bible database in the frontend to fetch and display the scripture content.

## Features
- **Real-time speech-to-text conversion** using Speechmatics AI.
- **Scripture extraction** from transcribed speech using Google Gemini AI.
- **Automatic scripture lookup** in a JSON-based Bible database.
- **Seamless streaming of audio and transcription** to maintain real-time performance.

## Installation

### Prerequisites
Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (LTS version recommended)
- npm (comes with Node.js)
- A Speechmatics API key
- A Google Gemini API key

### Setup
1. **Clone the repository:**
   ```sh
   git clone https://github.com/JeremyGemegah/AI-bible-quotation-app.git
   cd AI-bible-quotation-app
   ```
2. **Install dependencies:**
   ```sh
   npm install
   ```
3. **Set up environment variables(optional):**

* For now I have used my own API keys so if you want you can skip this step
   - Create a `.env` file in the root directory.
   - Add the following variables:
     ```env
     SPEECHMATICS_API_KEY=your_speechmatics_api_key
     GEMINI_API_KEY=your_gemini_api_key
     ```
  - Replace them in the code with each preceeded by "process.env"

## Usage

### Running the Application
Start the application using:
```sh
npm start
```

NOW HEAD OVER TO YOUR BROWSER AND VISIT "localhost:5000"

### How It Works
1. The app continuously listens for speech input.
2. Audio is streamed to Speechmatics for real-time transcription.
3. The transcribed text is streamed to Gemini AI, which extracts scripture references.
4. The frontend queries a JSON-based Bible database and displays the referenced scriptures automatically.


## Contributing
Contributions are welcome! Feel free to open issues or submit pull requests.

## License
This project is licensed under the [MIT License](LICENSE).

## Acknowledgments
- [Speechmatics](https://www.speechmatics.com/) for transcription services.
- [Google Gemini AI](https://ai.google.com/gemini/) for scripture extraction.
- Various open-source Bible databases for scripture content.

---
Feel free to customize this README based on your project's specific requirements!

