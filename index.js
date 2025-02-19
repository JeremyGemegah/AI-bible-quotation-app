// backend/index.js
const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path')
const https = require('https')
const {spawn} = require('child_process');





const app = express();
const port = 5000;

app.use(cors());
app.use(express.static(path.join(__dirname, './build')))



const ffmpegStatic = require('ffmpeg-static');
let ffmpegProcess = null;

// WebSocket Server
const server = app.listen(port, () => console.log(`Server running on port ${port}`));
const wss = new WebSocket.Server({ server });

//Transcription endpoint

const speechmatics_endpoint = 'wss://eu2.rt.speechmatics.com/v2';

//Transcriber configurations

const speechmaticsConfig ={
    "message": "StartRecognition",
    "audio_format": {
      "type": "raw",
      "encoding": "pcm_f32le",
      "sample_rate": 16000
    },
    "transcription_config": {
    "language": "en",
    "diarization": "none",
    "operating_point": "enhanced",
    "max_delay_mode": "flexible",
    "max_delay": 1,
    "enable_partials": true,
    "enable_entities": true
  } 
  };

  //scripture extractor endpoint
  const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

  const API_KEY = "AIzaSyBHjgb6uZLGIZmO8mFSmX6gTSZ3F9M1iNQ"

  let conversationHistory = [] //stores temporary context of text sent to Gemini

  //model client message
  let clientMessage = {status: '', type:'', message:''}

  //Function to process incoming response from Gemini and ping client

  const processText = async (text,ws) => {
      try{
          //add new text to context
          conversationHistory.push({role: "user", parts: text })
  
          //limit context to a manageable length
  
          if (conversationHistory.length > 5){
              conversationHistory.shift();
  
          }

          //Declaration of Gemini prompt
  
          const prompt = `
          You are an expert in identifying scripture references in text. Given a stream of text, identify any scripture references, both implicit (paraphrased) and explicit (quoted), along with the book, chapter and verses. 
           Return the scripture in JSON format as an array of objects:
          
           \`\`\`json
           [
             { "book": "Book Name", "chapter": 1, "verses": [1, 2, 3], "version": KJV },
              ...
           ]
           \`\`\`
  
           If no scriptures are found, do not return anything.
  
           The following is the conversation to be used as context:
           \`\`\`
           ${JSON.stringify(conversationHistory, null, 2)}
           \`\`\``;

           //Configuration of Gemini request
  
              const postData = JSON.stringify({
                  "contents": [{role:'user', parts: [{"text": prompt}]}],
                  generationConfig: {
                      maxOutputTokens: 2048,
                      response_mime_type: "application/json",
                          "response_schema": {
                    "type": "ARRAY",
                    "items": {
                      "type": "OBJECT",
                      "properties": {
                        "book": { "type": "STRING" },
                        "chapter": { "type": "INTEGER" },
                        "verses": { 
                          "type": "ARRAY",
                          "items": { "type": "INTEGER" }
                        }
                      }
                    }
  
                  }
                  },
                  safetySettings: [
                      {
                          category: "HARM_CATEGORY_HARASSMENT",
                          threshold: "BLOCK_MEDIUM_AND_ABOVE",
                      },
                      {
                          category: "HARM_CATEGORY_HATE_SPEECH",
                          threshold: "BLOCK_MEDIUM_AND_ABOVE",
                      },
                      
                  ]
              });
  
              const options ={
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      'x-goog-api-key': API_KEY
                  },
                };
                
                
                //Making request to Gemini and awaiting response
              
              
              
              const request = https.request(GEMINI_API_URL, options, (response) => {
                  let data = "";
  
                  response.on("data", (chunk) => {
                      data += chunk;
                  })
  
                  response.on("end", () => {
                      try {
                          const parsedResponse = JSON.parse(data)
  
                          if (parsedResponse.candidates && parsedResponse.candidates.length > 0){
                              const geminiResponseText = parsedResponse.candidates[0].content.parts[0].text;
                              /* console.log('Gemini response', geminiResponseText); */
                              try {
                                  const scriptures = JSON.parse(geminiResponseText)
  
                                  if (Array.isArray(scriptures) && scriptures.length > 0){
                                      console.log('Extracted scriptures:', scriptures)
                                      console.log("sending to frontend")
                                      clientMessage.status = 200
                                      clientMessage.type = 'application/json'
                                      clientMessage.message = scriptures
                                      ws.send(JSON.stringify(clientMessage))
                                  }
  
                              } catch(jsonError) {
                                  console.log("Gemini returnes non-json string", geminiResponseText)
                                  /* console.log('Failed to parse gemini\'s respons as JSON', jsonError.message) */
                              }
                          }else{
                                clientMessage.status = 429
                                clientMessage.type = 'application/json'
                                clientMessage.message = parsedResponse,null,2
                                ws.send(JSON.stringify(clientMessage))
                              console.error("Gemini Response Invalid", JSON.stringify(parsedResponse,null,2))
                          }
                      }catch(error){
                          console.log("Gemini returned invalid data", data)
                          console.log("Error parsing gemini's response", error)
                      }
                  })
  
                  response.on('error', (error) => {
                      console.log("Error parsing gemini's response", error)
                  })
              })
  
              request.write(postData)
              request.end()
      } catch (error) {
          console.log("Error from gemini api: ", error)
      }
  }

  //Event of successful connection with client

  wss.on('connection', (ws) => {

    console.log('WebSocket connection with client established');


    //Starting websocket connection to transcriber

      const speechmaticsSocket = new WebSocket(speechmatics_endpoint,{
        headers:{
            'authorization': 'Bearer eKxhFdm4xcpehHiBxJuIgdG4cFabNgGN'
        }
    });

    //Event of successfull connection to transcriber

    speechmaticsSocket.on('open', () => {
        console.log('Connected to Speechmatics server');
        clientMessage.status = 200
        clientMessage.type = 'text'
        clientMessage.message = 'successfully connected to transcriber'
        speechmaticsSocket.send(JSON.stringify(speechmaticsConfig));
        console.log('Session configuration sent');
        ws.send(JSON.stringify(clientMessage))

      });


      //Recieving data from transcriber

      speechmaticsSocket.on('message', async (aiData) => {
        try {
          const data = JSON.parse(aiData);
          const timestamp = new Date().toISOString();
      
          if (data.message === 'AddTranscript' || data.message === 'EndOfTranscript') {
            console.log(`[${timestamp}] Final Transcript: ${data.metadata.transcript}`);
            
            // Call processText asynchronously without awaiting
            processText(data.metadata.transcript,ws).catch(err => {
              console.error('Error processing text:', err);
            });
          }
        } catch (err) {
          console.error('Error processing AI message:', err);
          console.log(aiData)
        }
      });

      //Event of error connecting to transcriber

      speechmaticsSocket.on('error', (error) => {
        console.error('Speechmatics webSocket error:', error)
        clientMessage.status = 400
        clientMessage.type = 'text'
        clientMessage.message = 'error occured during connection to transcriber'
        ws.send(JSON.stringify(clientMessage))
    });

    //Event of transcriber connection closure

    speechmaticsSocket.on('close', () => {
        console.log('SPeechmatics webSocket closed')
        clientMessage.status = 201
        clientMessage.type = 'text'
        clientMessage.message = 'connection with transcriber closed'
        ws.send(JSON.stringify(clientMessage))

        if (ffmpegProcess) {
            ffmpegProcess.stdin.end();
          ffmpegProcess.kill("SIGINT");
          ffmpegProcess = null;
        }


    });

    // ffmpeg processing
    if(ffmpegProcess){
        ffmpegProcess.kill("SIGINT")
    }

    ffmpegProcess = spawn(ffmpegStatic, [
        '-f', 'matroska',
        '-i', 'pipe:0',
        '-ac', '1',
        '-ar', '16000',
        '-acodec', 'pcm_f32le',
        '-f', 'f32le',
        'pipe:1'
      ]);
    
      ffmpegProcess.stdout.on('data', (chunk) => {
        if (speechmaticsSocket.readyState === WebSocket.OPEN) {
          speechmaticsSocket.send(chunk);
        }
      });
    
      /* ffmpegProcess.stderr.on('data', (data) => console.error(`FFmpeg stderr: ${data}`)); */
      ffmpegProcess.on('error', (err) => console.error(`FFmpeg error: ${err.message}`));
      ffmpegProcess.on('close', (code) => console.log(`FFmpeg process exited with code ${code}`));


    
        //Event of recieving message from  client

         ws.on('message', (message) => {
            /* console.log(`Received from client: ${message}`); */
        
        
          

          try {
            ffmpegProcess.stdin.write(message);
          } catch (error) {
            console.error(`Error writing to FFmpeg stdin: ${error.message}`);
          } 
            /* const stream = fs.createReadStream('./audio/audio.raw',{ highWaterMark: 19200});
        
          // When a chunk is available, send it over the WebSocket
          stream.on('data', (chunk) => {
            speechmaticsSocket.send(chunk, { binary: true }, (error) => {
              if (error) console.error('Error sending chunk:', error);
            });
          });
        
          stream.on('end', () => {
            console.log('Finished sending file');
            // Optionally, send a message to signal the end of the file
             speechmaticsSocket.send(JSON.stringify({ message : "EndOfStream", last_seq_no: 120}));
          });
        
          stream.on('error', (err) => {
            console.error('Error reading file:', err);
          });
        
             */
            /* ws.send(JSON.stringify(message)); */
          });
        


          //Event of client connection closure

          ws.on('close', () => {
            console.log('Client disconnected')
            clientMessage.status = 200
            clientMessage.type = 'text'
            clientMessage.message = 'connection with server closed'
            ws.send(JSON.stringify(clientMessage))
            if (ffmpegProcess) {
                ffmpegProcess.stdin.end();
              ffmpegProcess.kill("SIGINT");
              ffmpegProcess = null;
            }

            speechmaticsSocket.close()
        });


  })
  


  