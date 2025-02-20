// backend/index.js
const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const fs = require('fs')
const https = require('https')


const app = express();
const port = 5000;

app.use(cors());


// WebSocket Server
const server = app.listen(port, () => console.log(`Server running on port ${port}`));
const wss = new WebSocket.Server({ server });

const AI_ENDPOINT = 'wss://eu2.rt.speechmatics.com/v2';

  
let conversationHistory = []
const API_KEY = "AIzaSyBHjgb6uZLGIZmO8mFSmX6gTSZ3F9M1iNQ"
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
  








const processText = async (text,ws) => {
    try{
        //add new text to context
        conversationHistory.push({role: "user", parts: text })

        //limit context to a manageable length

        if (conversationHistory.length > 5){
            conversationHistory.shift();

        }

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
                                    ws.send(JSON.stringify(scriptures))
                                }

                            } catch(jsonError) {
                                console.log("Gemini returnes non-json string", geminiResponseText)
                                /* console.log('Failed to parse gemini\'s respons as JSON', jsonError.message) */
                            }
                        }else{
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
  
  wss.on('connection',  (ws) => {
      console.log('WebSocket connection with frontend established');
      

  const aiSocket = new WebSocket(AI_ENDPOINT,{
    headers:{
        'authorization': 'Bearer eKxhFdm4xcpehHiBxJuIgdG4cFabNgGN'
    }
});

  aiSocket.on('open', () => {
    console.log('Connected to echo WebSocket');
  });


  aiSocket.on('message', async (aiData) => {
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
    }
  });

  aiSocket.on('error', (error) => console.error('AI WebSocket error:', error));

  aiSocket.on('close', () => console.log('AI WebSocket closed'));
  
  ws.on('message', (message) => {
    console.log(`Received from frontend: ${message}`);

      // Send session configuration
  const sessionConfig ={
    "message": "StartRecognition",
    "audio_format": {
      "type": "raw",
      "encoding": "pcm_f32le",
      "sample_rate": 48000
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


  aiSocket.send(JSON.stringify(sessionConfig));
  console.log('Session configuration sent');
    
    const stream = fs.createReadStream('./wav.wav',{ highWaterMark: 19200});

  // When a chunk is available, send it over the WebSocket
  stream.on('data', (chunk) => {
    aiSocket.send(chunk, { binary: true }, (error) => {
      if (error) console.error('Error sending chunk:', error);
    });
  });

  stream.on('end', () => {
    console.log('Finished sending file');
    // Optionally, send a message to signal the end of the file
    /* aiSocket.send(JSON.stringify({ message : "EndOfStream", last_seq_no: 120})); */
  });

  stream.on('error', (err) => {
    console.error('Error reading file:', err);
  });

    
    /* ws.send(JSON.stringify(message)); */
  });

  ws.on('close', () => console.log('WebSocket disconnected'));
});
