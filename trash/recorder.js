// server.js
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const {spawn} = require('child_process');
const express = require('express')
const cors = require('cors')


const ffmpegStatic = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');

// Tell fluent-ffmpeg where it can find FFmpeg




const outputDir = path.join(__dirname, "audio");

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

const app = express()
app.use(cors())
app.use('/audio', express.static(outputDir))

const server = app.listen(4000, () => {
    console.log("HTTP server is listening on port 8082")
})

const wss = new WebSocket.Server({ server });

let ffmpegProcess = null;
let recordingTimer = null;

const startFFmpeg = () => {
    if(ffmpegProcess){
        ffmpegProcess.kill("SIGINT")
    }

    const streamKey = "audio"
    const playlist = path.join(outputDir, `${streamKey}.m3u8`)

    ffmpegProcess = spawn(ffmpegStatic,[
       '-f', 'matroska', // Proper format for WebM
    '-i', 'pipe:0',
    '-ac', '1',            // Mono channel
    '-ar', '16000',       // 16kHz sample rate
    '-acodec', 'pcm_f32le', // 32-bit float PCM
    '-f', 'f32le',   path.join(outputDir, `${streamKey}.raw`),
        
    ])

    ffmpegProcess.stdout.on("data",(data) => {
        console.log(`FFmpeg stdout: ${data}`)
    })

    ffmpegProcess.stderr.on("data", (data) => {
        console.error(`FFmpeg stderr: ${data}`);
      });
    
      ffmpegProcess.on("error", (err) => {
        console.error(`FFmpeg process error: ${err.message}`);
        ffmpegProcess = null;
      });
    
      ffmpegProcess.on("close", (code) => {
        console.log(`FFmpeg process exited with code ${code}`);
        if (code !== 0) {
          console.error(`FFmpeg process exited with non-zero code: ${code}`);
        }
        ffmpegProcess = null;
        startFFmpeg();
      });
}

startFFmpeg();


wss.on("connection", (ws) => {
    console.log("Client connected");

    recordingTimer = setTimeout(() => {
        if (ffmpegProcess) {
          ffmpegProcess.kill('SIGINT');
          console.log('Recording finalized after 2 seconds');
        }
      }, 2000);
  
    ws.on("message", (message) => {
      console.log(`Received message of size ${message.byteLength} bytes`);
      if (ffmpegProcess) {
        try {
          ffmpegProcess.stdin.write(Buffer.from(message));
        } catch (error) {
          console.error(`Error writing to FFmpeg stdin: ${error.message}`);
        }
      } else {
        console.error("FFmpeg process not available. Dropping message.");
      }
    });
  
    ws.on("close", () => {
      console.log("Client disconnected");
      if (ffmpegProcess) {
          ffmpegProcess.stdin.end();
        ffmpegProcess.kill("SIGINT");
        ffmpegProcess = null;
      }
    });
  
    ws.on("error", (error) => {
      console.error(`WebSocket error: ${error.message}`);
    });
  });