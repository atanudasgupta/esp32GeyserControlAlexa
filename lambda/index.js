/* *
 * This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
 * Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
 * session persistence, api calls, and more.
 * */
const Alexa = require('ask-sdk-core');
const shadowops = require('./shadowops');
const DEFAULT_MIN=10;
const  DEFAULT_MAX = 30;


//Loading AWS SDK libraries

var AWS = require('aws-sdk');

const axios = require('axios');
const moment = require("moment");

const timerItem = {
    "duration": "PT10M",
    "creationBehavior": {
        "displayExperience": {
            "visibility": "HIDDEN"
        }
    },
    "triggeringBehavior": {
        "operation": {
            "type": "ANNOUNCE",
            "textToAnnounce": [
                {
                    "locale": "en-US",
                    "text": "This ends your geyser timer, take bath now"
                }
            ]
        },
        "notificationConfig": {
            "playAudible": false
        }
    }
};
 
var global_ID;

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
     handle(handlerInput) {
      
        const speakOutput = '<amazon:emotion name="disappointed" intensity="high">' +   
   'Welcome, you may control your Geyser and I will remind you before Geyser switches off. Ask for help to understand your choices  </amazon:emotion>';
 
        return handlerInput.responseBuilder
         
            .speak(speakOutput)
            .reprompt('Ask for help if needed')
            .getResponse();
        
    }
};

const ConnectionsResponsetHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'Connections.Response';
    },
    handle(handlerInput) {
        const { permissions } = handlerInput.requestEnvelope.context.System.user;

      

        const status = handlerInput.requestEnvelope.request.payload.status;
 
        if (!permissions) {
                handlerInput.responseBuilder
                .speak("I didn't hear your answer. This skill requires your permission.")
                .addDirective({
                    type: "Connections.SendRequest",
                    name: "AskFor",
                    payload: {
                        "@type": "AskForPermissionsConsentRequest",
                        "@version": "1",
                        "permissionScope": "alexa::alerts:timers:skill:readwrite"
                    },
                    token: "",
                    'shouldEndSession': true
                })
                .getResponse();
                
                 
        }

        switch (status) {
            case "ACCEPTED":
                handlerInput.responseBuilder
                    .speak("Now that we have permission to set a timer. Would you like to start?")
                    .reprompt('would you like to start?')
                break;
            case "DENIED":
                handlerInput.responseBuilder
                    .speak("Without permissions, I can't set a timer. So I guess that's goodbye.");
                break;
            case "NOT_ANSWERED":

                break;
            default:
                handlerInput.responseBuilder
                    .speak("Now that we have permission to set a timer. Would you like to start?")
                    .reprompt('would you like to start?');
        }

        return handlerInput.responseBuilder
            .getResponse();
    }
};

const TimerStartIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' 
             && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'TimerStartIntent') 
           
                
    },
    async handle(handlerInput) {

        console.log('Inside timer Intent ++++');

        const request = handlerInput.requestEnvelope.request;
        
        const intent = request.intent;
        console.log('COnfrmation status  ='+ intent.confirmationStatus);

        if ( intent.confirmationStatus === 'DENIED'||Alexa.getIntentName(handlerInput.requestEnvelope) === 'NoIntent' ){
             handlerInput.responseBuilder
            .speak('Ok, I will not set the timer, please remember to take bath !');
            
            
        }
        else {

                const { permissions } = handlerInput.requestEnvelope.context.System.user;

                if (!permissions) {

                    console.log('Inside yes or No');


                    return handlerInput.responseBuilder
                        .speak("This skill needs permission to access your timers.")
                        
                        
                        .addDirective({
                            type: "Connections.SendRequest",
                            name: "AskFor",
                            payload: {
                                "@type": "AskForPermissionsConsentRequest",
                                "@version": "1",
                                "permissionScope": "alexa::alerts:timers:skill:readwrite"
                            },
                            token: "",
                            'shouldEndSession': true
                        })
                        .getResponse()
                        .catch((err) => {
                            console.log("Error while getting permission", err);
                            const speechText = "Failed to prompt for permission ! "
                            return handlerInput.responseBuilder
                            .speak(speechText)
                            .getResponse();
                        })
                
                } else {
                    console.log( 'Inside timer 1');
                
                //handle default
            
                    const duration = moment.duration(timerItem.duration),
                        hours = (duration.hours() > 0) ? `${duration.hours()} ${(duration.hours() === 1) ? "hour" : "hours"},` : "",
                        minutes = (duration.minutes() > 0) ? `${duration.minutes()} ${(duration.minutes() === 1) ? "minute" : "minutes"} ` : "",
                        seconds = (duration.seconds() > 0) ? `${duration.seconds()} ${(duration.seconds() === 1) ? "second" : "seconds"}` : "";

                    const options = {
                        headers: {
                            "Authorization": `Bearer ${Alexa.getApiAccessToken(handlerInput.requestEnvelope)}`,
                            "Content-Type": "application/json"
                        }
                    };

                    // code for delete timer.

                    await axios.delete('https://api.amazonalexa.com/v1/alerts/timers',  options)
                    .then((response) => {
                        console.log( ' Your timer is successfully deleted');
                    
                    })
                    .catch(error => {
                        console.log(error);
                        handlerInput.responseBuilder.speak('Could not delete timer!');
                    });

                    await axios.post('https://api.amazonalexa.com/v1/alerts/timers', timerItem, options)
                        .then((response) => {
                            handlerInput.responseBuilder
                                .speak(`Your timer is set for ${hours} ${minutes} ${seconds}.<audio src="soundbank://soundlibrary/weather/rain/rain_03"/>`);
                        console.log('response object= '+ response.data.status);
                        global_ID=response.data.id; // timer ID 
                        console.log( 'GLOBAL ID ==='+ global_ID);
                        })
                        .catch(error => {
                            console.log(error);
                            handlerInput.responseBuilder.speak('Could not set timer!');
                        });

                        // half timer

                        
                        var fullDuration = timerItem.duration.match(/\d+/g);
                        var halfDuration = Math.floor(fullDuration*0.5);
                        var eightPercent = Math.floor(fullDuration*0.8);
                        var halfDiff = fullDuration - halfDuration;
                        var eightDiff = fullDuration - eightPercent;


                        timerItem.duration="PT"+halfDuration+"M";
                        console.log ('halfDuration='+ halfDuration);
                        timerItem.triggeringBehavior.operation.textToAnnounce[0].text= halfDiff+" minutes, is remaining" ;
                        


                        await axios.post('https://api.amazonalexa.com/v1/alerts/timers', timerItem, options)
                        .then((response) => {
                             
                        console.log('response object2= '+ response.data.status);
                        global_ID=response.data.id; // timer ID 
                        console.log( 'GLOBAL ID2 ==='+ global_ID);
                        })
                        .catch(error => {
                            console.log(error);
                            handlerInput.responseBuilder.speak('Could not set timer2!');
                        });

                        // timer for eighty percent
                        timerItem.duration="PT"+eightPercent+"M";
                        console.log ('80percent='+ eightPercent);

 
                        timerItem.triggeringBehavior.operation.textToAnnounce[0].text= eightDiff +" minutes, is remaining" ;


                        await axios.post('https://api.amazonalexa.com/v1/alerts/timers', timerItem, options)
                        .then((response) => {
                             
                        console.log('response object2= '+ response.data.status);
                        global_ID=response.data.id; // timer ID 
                        console.log( 'GLOBAL ID3 ==='+ global_ID);
                        })
                        .catch(error => {
                            console.log(error);
                            handlerInput.responseBuilder.speak('Could not set timer3!');
                        });
                    }   
                
        }       
       
        return handlerInput.responseBuilder
            .getResponse();
    }
};


const changeDurationIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'changeDurationIntent';
    },
    async handle(handlerInput) {
        
        var duration = handlerInput.requestEnvelope.request.intent.slots.time.value;
        if (duration <DEFAULT_MIN || duration > DEFAULT_MAX )
            duration=DEFAULT_MIN;

        const speechText = `Your Geyser duration is set to  "${duration}"  minutes`;

        timerItem.duration="PT"+duration+"M";

         var val=0; // you could first enquire current state instead of switching on the geyser
         return shadowops.onOroffshadow()
         .then((data) => {
         
        if (data === 1) 
            val=1;
               
             
         return shadowops.updateshadow(val,parseInt(duration,10))
         .then((data) => {
   
               
                timerItem.duration="PT"+duration+"M";

                // check if Geyser is already on. 
             if (val ===1)   
                
              return handlerInput.responseBuilder
             
                 .addDelegateDirective({
                 name: 'TimerStartIntent',
                 confirmationStatus: 'NONE',
                 slots: {}
            })
                .speak(speechText)          
                .getResponse();
            else    
              return handlerInput.responseBuilder            
           
               .speak(speechText)          
               .getResponse();  


         })
         .catch((err) => {
           console.log("Error while updating duration", err);
           speechText = "Failed to update duration ! "
           return handlerInput.responseBuilder
             .speak(speechText)
             .getResponse();
         })
  
        
    })
     },
     
};

const switchOnGeyserHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'switchOnGeyserIntent';
    },
    async handle(handlerInput) {
 
         var val=1;
         var duration;
         var objState;
         return shadowops.onOroffshadow()
         .then((data) => {
         
             if (data === val ){
                 const speechText = `Your geyser is already on`;
                 return handlerInput.responseBuilder
                .speak(speechText)
                .getResponse();
             }
         
             else {
        
        return shadowops.enquireshadow()
         .then((data) => {
           // process the retrived shadow

           objState = JSON.parse(data.payload);     
         
            
           duration = objState.state.desired.duration;
           console.log("Desired duration " + duration);
           timerItem.duration="PT"+duration+"M";

         
         console.log("Desired duration2222 " + duration);
         return shadowops.updateshadow(val, duration)
         .then((data) => {
           

         const speechText = `<amazon:emotion name="excited" intensity="medium"> You switched on the Geyser for "${duration}" minutes.</amazon:emotion>`;

           
           return handlerInput.responseBuilder
             
             .addDelegateDirective({
                name: 'TimerStartIntent',
                confirmationStatus: 'NONE',
                slots: {}
            })
            .speak(speechText)
             .getResponse();
         })
         .catch((err) => {
           console.log("Error while updating", err);
           const speechText = "Failed to switch on the Geyser ! "
           return handlerInput.responseBuilder
             .speak(speechText)
             .getResponse();
         })
        })
        }
    })
     },
     
};

const switchOffGeyserHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'switchOffGeyserIntent';
    },
    async handle(handlerInput) {
 
        var val=0;
        //   check the status first
        return shadowops.onOroffshadow()
        .then((data) => {
        
            if (data === val){
                const speechText = `Your geyser is already off`;
                return handlerInput.responseBuilder
               .speak(speechText)
               .getResponse();
            }
        
            else {
                

        return shadowops.updateshadow(val)
         .then((data) => {

           const speechText = `You switched off the Geyser`;
           const options = {
            headers: {
                "Authorization": `Bearer ${Alexa.getApiAccessToken(handlerInput.requestEnvelope)}`,
                "Content-Type": "application/json"
            }
        };

        axios.delete('https://api.amazonalexa.com/v1/alerts/timers',  options)
            .then((response) => {
                console.log( ' Your timer is successfully deleted');
               
            })
            .catch(error => {
                console.log(error);
                handlerInput.responseBuilder.speak('Could not delete timer!');
            });
           return handlerInput.responseBuilder
             .speak(speechText)
             .getResponse();
         })
         .catch((err) => {
           console.log("Error while updating", err);
           const speechText = "Failed to switch off the Geyser ! "
           return handlerInput.responseBuilder
             .speak(speechText)
             .getResponse();
         })
         
    }
    
})}
};

const enquireGeyserHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'enquireGeyserIntent';
    },
    async handle(handlerInput) {

        var objState;
        var statusstring;

        const request = handlerInput.requestEnvelope.request;
        
        const intent = request.intent;
        console.log('COnfrmation status2  ='+ intent.confirmationStatus);

        if ( intent.confirmationStatus === 'DENIED'||Alexa.getIntentName(handlerInput.requestEnvelope) === 'NoIntent' ){
            return handlerInput.responseBuilder
            .speak('Ok, no issues')
            .getResponse();
            
            
        }

        if (intent.confirmationStatus === 'CONFIRMED') {
          return shadowops.enquireshadow()
         .then((data) => {
           // process the retrived shadow

           objState = JSON.parse(data.payload);     
           
           var timeremaining = objState.state.reported.remaining;
           var duration = objState.state.reported.duration;
           var status = objState.state.reported.onOroff;

           var total = objState.state.reported.total;

           if ( status === 1)
            statusstring='ON';
           else 
            statusstring='OFF' ;

 
           const speechText = `<speak> <voice name="Matthew"> Your Geyser state is "${statusstring}", duration is set to "${duration}" minutes ,remaining time is "${timeremaining}" minutes and monthly average usage is "${total}" minutes</voice></speak>`;
           return handlerInput.responseBuilder
             .speak(speechText)
             .getResponse();
         })
         .catch((err) => {
           console.log("Error while fetching data", err);
           const speechText = "Failed to fetch data from the Geyser ! ";
           return handlerInput.responseBuilder
             .speak(speechText)
             .getResponse();
         })
        } 
        
    }
};


const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Now you can do the following operations.<prosody rate="slow">' +
        ', Turn on Geyser or start geyser.  ' + 
        ', Turn off Geyser or stop geyser, ' +
        ', Geyser status, to know much time is remaining,' +
        ', change duration to alter how long the Geyser should be on. </prosody> ' 
        return handlerInput.responseBuilder 
            .speak(speakOutput) 
            .reprompt(speakOutput) 
            .getResponse(); 
    }
};



const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Goodbye!';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
/* *
 * FallbackIntent triggers when a customer says something that doesn’t map to any intents in your skill
 * It must also be defined in the language model (if the locale supports it)
 * This handler can be safely added but will be ingnored in locales that do not support it yet 
 * */
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Sorry, I don\'t know about that. Please try again.';
        const rePromptText = 'You can either turn on, enquire or change duration for the Geyser';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
/* *
 * SessionEndedRequest notifies that a session was ended. This handler will be triggered when a currently open 
 * session is closed for one of the following reasons: 1) The user says "exit" or "quit". 2) The user does not 
 * respond or says something that does not match an intent defined in your voice model. 3) An error occurs 
 * */
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse(); // notice we send an empty response
    }
};
/* *
 * The intent reflector is used for interaction model testing and debugging.
 * It will simply repeat the intent the user said. You can create custom handlers for your intents 
 * by defining them above, then also adding them to the request handler chain below 
 * */
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};
/**
 * Generic error handling to capture any syntax or routing errors. If you receive an error
 * stating the request handler chain is not found, you have not implemented a handler for
 * the intent being invoked or included it in the skill builder below 
 * */
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        const speakOutput = 'Sorry, I had trouble doing what you asked. Please try again.';
        console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

/**
 * This handler acts as the entry point for your skill, routing all request and response
 * payloads to the handlers above. Make sure any new handlers or interceptors you've
 * defined are included below. The order matters - they're processed top to bottom 
 * */
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        changeDurationIntentHandler,
        switchOnGeyserHandler,
        switchOffGeyserHandler,
        enquireGeyserHandler,
        HelpIntentHandler,
        TimerStartIntentHandler ,
        ConnectionsResponsetHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler)
    .addErrorHandlers(
        ErrorHandler)
    .withApiClient(new Alexa.DefaultApiClient())
    .lambda();