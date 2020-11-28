            /*
 Version 2.0- Nov 26 2020

 Atanu, implemented with SSL, aws certificates and Blynk api key
*/ 

#include <Arduino.h>
#include <WiFiClientSecure.h>
#include <BlynkSimpleEsp32_SSL.h>
#include "SPIFFS.h"
#include "FS.h"
#include "./credentials_ankita.h"
#include "./certs.h"


#include <WiFi.h>
#include <ArduinoOTA.h>
#include <ArduinoJson.h>  
#include <StreamString.h>

#include <TimeLib.h>
#include <WidgetRTC.h>
#include <MQTTClient.h>
 

#define DEFAULT_MIN 10 // min delay 
#define DEFAULT_MAX 30 // max delay
#define DEFAULT_TIMER 600000L //10 min  // default auto-switch off , 6 min
#define MULTIPLIER 60000L // 1 min  // slider value is multiplied by this.
#define CLOCKCHECK 300000L // 5 min  // slider value is multiplied by this.

#define TOHOUR 60
int   timerId_updateplots;
bool isHigh=false;
WidgetLED led1(V22);
int incrementPinValue2=0;

WidgetRTC rtc;

// for Alexa skill Geyser Control

MQTTClient client = MQTTClient(1024);
WiFiClientSecure net = WiFiClientSecure();
bool msgReceived=false;
int recdDuration=0;
int  statusValue=-1;
bool   fromBlynk=false;


int days=0; // todays day
int hours=0; // current hour

BlynkTimer  timer_updateplots,timer_T;
int pinValue=0,pinValue2=0;
int total_t=0; // total time
unsigned long currenttime=0;

#define HEARTBEAT_INTERVAL 300000 // 5 Minutes 

 
int ledPin=4; // relay pin on ESP32

void updateRemaining(float average)
{
  StaticJsonDocument<1024> jsonDoc;
    char jsonBuffer[1024];

  float rounded = ((int)(average * 100 + .5) / 100.0);
   JsonObject stateObj = jsonDoc.createNestedObject("state");
  JsonObject reportedObj = stateObj.createNestedObject("reported");
     
  reportedObj["remaining"] = (pinValue2 -incrementPinValue2);
  reportedObj["total"] = rounded;

   
  serializeJson(jsonDoc, jsonBuffer);

  client.publish(AWS_IOT_TOPIC, jsonBuffer);
}

void receivedDuration()
{
  StaticJsonDocument<1024> jsonDoc;
  char jsonBuffer[1024];

  
   JsonObject stateObj = jsonDoc.createNestedObject("state");
   JsonObject reportedObj = stateObj.createNestedObject("reported");

  if (fromBlynk) {
        JsonObject desiredObj = stateObj.createNestedObject("desired");
        desiredObj["duration"] = recdDuration;
  }
  else
    {
      pinValue2=recdDuration;
      Blynk.virtualWrite (V24, pinValue2);
      Blynk.virtualWrite(V23,pinValue2);
    }
  
  reportedObj["duration"] = recdDuration;

  serializeJson(jsonDoc, jsonBuffer);

  client.publish(AWS_IOT_TOPIC, jsonBuffer);
  
   
}
 

void switchOnsendJsonToAWS()
{
  StaticJsonDocument<1024> jsonDoc;
  char jsonBuffer[1024];
 
  JsonObject stateObj = jsonDoc.createNestedObject("state");
  JsonObject reportedObj = stateObj.createNestedObject("reported");
  
  reportedObj["onOroff"] = HIGH;
  reportedObj["duration"] = recdDuration;
  reportedObj["remaining"] =recdDuration ;  // initial value
  
  if (fromBlynk) {
        JsonObject desiredObj = stateObj.createNestedObject("desired");
        desiredObj["duration"] = recdDuration;
        desiredObj["onOroff"] = HIGH;
  }
  
  serializeJson(jsonDoc, jsonBuffer);

  client.publish(AWS_IOT_TOPIC, jsonBuffer);
  pinValue2=recdDuration;
  isHigh=HIGH;
  update_App(); // update the Blynk widgets
}
void switchOffsendJsonToAWS()
{
  StaticJsonDocument<1024> jsonDoc;
  char jsonBuffer[1024];

  
  JsonObject stateObj = jsonDoc.createNestedObject("state");
  JsonObject reportedObj = stateObj.createNestedObject("reported");
  JsonObject desiredObj = stateObj.createNestedObject("desired");

  
  reportedObj["onOroff"] = LOW;
  reportedObj["remaining"] = 0;
  reportedObj["duration"] = DEFAULT_MIN;

  if (fromBlynk) {
        desiredObj["duration"] = DEFAULT_MIN;
        desiredObj["onOroff"] = LOW;
  }
  
  serializeJson(jsonDoc, jsonBuffer);

  client.publish(AWS_IOT_TOPIC, jsonBuffer);
  
  isHigh=LOW;
  update_App();
}

void update_App() // Button
{

  if ( fromBlynk )
    return;

  pinValue =  isHigh;
  
  Serial.print("V21 Button value is: ");
  Serial.println(pinValue);
  digitalWrite (ledPin, pinValue);   // for relay
  if (pinValue){
    led1.on();
    currenttime = millis() ;
   Blynk.virtualWrite (V24, pinValue2);// remaining time is same as initial duration
     
  }
  else {
    led1.off (); 
     
    unsigned long diff = (millis()- currenttime);
    pinValue2=int(diff/MULTIPLIER);
    
 
    incrementPinValue2=0;
    pinValue2=DEFAULT_MIN;
    Blynk.virtualWrite (V24, 0); // remaining time to zero keep consistency with Alexa IOT shadow
    
  }  
    
    Blynk.virtualWrite(V23,pinValue2);

}  

void startOTA() { // Start the OTA service
 
  ArduinoOTA.setHostname(OTAName);

  ArduinoOTA.onStart([]() {
    Serial.println("Start");
    
  });
  ArduinoOTA.onEnd([]() {
    Serial.println("\r\nEnd");
  });
  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
  });
  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("Error[%u]: ", error);
 
    if (error == OTA_AUTH_ERROR)         

      Serial.println("Auth Failed");
    else if (error == OTA_BEGIN_ERROR)         

      Serial.println("Begin Failed");
    else if (error == OTA_CONNECT_ERROR)          

      Serial.println("Connect Failed");
    else if (error == OTA_RECEIVE_ERROR)          
      Serial.println("Receive Failed");
    else if (error == OTA_END_ERROR)          

    Serial.println("End Failed");
  });
  ArduinoOTA.begin();
  Serial.println("OTA ready\r\n");
}

// AWS IOT 

void connectToAWS()
{
  // Configure WiFiClientSecure to use the AWS certificates we generated
  net.setCACert(AWS_CERT_CA);
  net.setCertificate(AWS_CERT_CRT);
  net.setPrivateKey(AWS_CERT_PRIVATE);

  // Connect to the MQTT broker on the AWS endpoint we defined earlier
  client.begin(AWS_IOT_ENDPOINT, 8883, net);

  client.onMessage(mqttCallback);

  // Try to connect to AWS and count how many times we retried.
  int retries = 0;
  Serial.println("Connecting to AWS IOT");

  while (!client.connect(DEVICE_NAME) && retries < AWS_MAX_RECONNECT_TRIES) {
    Serial.print(".");
    
    delay(100);
    retries++;
  }

  // Make sure that we did indeed successfully connect to the MQTT broker
  // If not we just end the function and wait for the next loop.
  if(!client.connected()){
    Serial.println(" Timeout!");
    return;
  }

  // If we land here, we have successfully connected to AWS!
  // And we can subscribe to topics and send messages.
  Serial.println("Connected!");
  
}

// msqtt subscribe to delta

void mqttCallback (String &topic, String &payload) {
   StaticJsonDocument<1024> doc;

   // Test if parsing succeeds.

   DeserializationError error = deserializeJson(doc, payload);
  if (error) {
    Serial.print(F("deserializeJson() failed: "));
    return;
  }

   //serializeJsonPretty(doc, Serial);
   int found = payload.indexOf ( 'onOroff');

   if ( found == -1)   
      statusValue=-1;
    else  
       statusValue=doc["state"]["onOroff"];
 
   recdDuration=doc["state"]["duration"];
   if ( recdDuration == NULL ) 
    recdDuration=DEFAULT_MIN; 
    
   msgReceived=true;
   fromBlynk=false;

}

void setup() {
  Serial.begin(115200);
  
   
   if(!SPIFFS.begin()){
        Serial.println("SPIFFS Mount Failed");
        return;
  }
  pinMode (ledPin,OUTPUT);
  digitalWrite (ledPin, LOW); // change for relay


  timerId_updateplots= timer_updateplots.setInterval(MULTIPLIER, updateplots);
  pinValue2=DEFAULT_MIN;

   total_t=readFile(SPIFFS, FILE_NAME);
       
   
  Blynk.begin(bAuth, MySSID, MyWifiPassword);
 

  setSyncInterval(10 * 60); // Sync interval in seconds (10 minutes)

  // Display digital clock every 5 min
  timer_T.setInterval(CLOCKCHECK, timeCheck);
  
  // connect to AWS IOT
  connectToAWS();
  client.subscribe(AWS_IOT_TOPIC_SUB);
    
  startOTA();


  Blynk.virtualWrite (V24, pinValue2);
  Blynk.virtualWrite (V23, pinValue2);
  Blynk.virtualWrite(V21,LOW);
  digitalWrite (ledPin, LOW); // change for relay

  led1.off();


}



//Code copied from blynk program  

bool offOrOn()
{
 
   if ( pinValue2==incrementPinValue2){
    digitalWrite (ledPin, LOW);// switch off relay
    Blynk.virtualWrite(V21,!pinValue);
    led1.off();
    incrementPinValue2=0;
    
    pinValue=0;
   
    pinValue2=recdDuration=DEFAULT_MIN;
    fromBlynk=true;
    // change duration back to default value in Blynk
    Blynk.virtualWrite(V23,pinValue2);

    switchOffsendJsonToAWS();
 
    return true;
    
   }
   return false;
}

// update plots every minutes and also update the slider as time goes on
void updateplots() { 
  char duration[100];
  if (pinValue) { // led is on
            
            Blynk.virtualWrite (V24, pinValue2 -incrementPinValue2 );
            Blynk.virtualWrite ( V29, total_t); // duration in hrs V29
            Blynk.virtualWrite ( V28, incrementPinValue2); // duration
            
            sprintf ( duration, "%d", total_t);
            writeFile(SPIFFS, FILE_NAME, duration); // persist to file
            if (offOrOn())
              return;

            total_t ++;
            if (days)
                updateRemaining((float)total_t/days); 
            incrementPinValue2++;

  
    }
    else { // when led is off
      if ( days == 1 && hours <4 && total_t !=0 ) {
          total_t=0; // recycle the duration, month beginning
          sprintf ( duration, "%d", total_t);
          writeFile(SPIFFS, FILE_NAME, duration); // persist to file
          updateRemaining((float)total_t/days); 

        }
      }
   if (days) 
    Blynk.virtualWrite(V25,(float)total_t/days); // average usage in min in this month
   else 
     Blynk.virtualWrite(V25,"..."); // average usage in min in this month

  }

// finding days and date from RTC
void timeCheck()
{
  // You can call hour(), minute(), ... at any time
  // Please see Time library examples for details

  
  days=day();
  hours=hour();
   
} 
 

BLYNK_WRITE(V21) // Button
{
   pinValue = param.asInt(); // assigning incoming value from pin V21 to a variable
  
  Serial.print("V21 Button value is--: ");
  Serial.println(pinValue);
  digitalWrite (ledPin, pinValue);  // for relay

  fromBlynk=true;

  if (pinValue){
      led1.on();
      currenttime = millis();

      recdDuration = pinValue2;
      switchOnsendJsonToAWS();
   
    }
  else {
    led1.off (); 
     
    unsigned long diff = (millis()- currenttime);
    pinValue2=int(diff/MULTIPLIER);

    incrementPinValue2=0;
    pinValue2=recdDuration=DEFAULT_MIN;
    switchOffsendJsonToAWS();
      
  }  
   Blynk.virtualWrite(V24,pinValue2);
   Blynk.virtualWrite(V23,pinValue2);
 
}  

BLYNK_WRITE(V23) // Horizontal step
{
  pinValue2 = param.asInt(); // assigning incoming value from pin V23 to a variable
  
  incrementPinValue2=0;
  recdDuration = pinValue2;
 
  Blynk.virtualWrite(V24,pinValue2);
  fromBlynk=true;
  receivedDuration(); 
 

}  

BLYNK_CONNECTED() {
    
    rtc.begin(); 

  }

// Store to SPIFFS

void writeFile(fs::FS &fs, const char * path, const char * message){
    Serial.printf("Writing file: %s\n", path);

    File file = fs.open(path, FILE_WRITE);
    if(!file){
        Serial.println("- failed to open file for writing");
        return;
    }
    
    if(file.println(message)){
        Serial.println("- file written ");
    } else {
        Serial.println("- frite failed");
    }
    file.close();
         
 }

 int readFile(fs::FS &fs, const char * path){
    int i=0;
    String c;
    Serial.printf("Reading file: %s\n", path);

    File file = fs.open(path);
    if(!file || file.isDirectory()){
        Serial.println("- failed to open file for reading");
        return 0;
    }

    Serial.println("- read from file:");
    

    while(file.available())
    {
       
       c = file.readStringUntil('\n');
      
    }
    Serial.printf("read value=%s\n",c);
    file.close();

    return (c.toInt());  
     
}

void WifiCheck() { // when Wifi is disconnected , reconnect
  int NAcounts=0;
  
    WiFi.disconnect();
    
  
  WiFi.begin(MySSID, MyWifiPassword); 

  while (WiFi.status() != WL_CONNECTED && NAcounts < 7 )
    {
    delay(500);
    Serial.print(".");
    NAcounts ++;
    }
 
 
 if(WiFi.status() != WL_CONNECTED){//during lost connection, print dots
    
    esp_sleep_enable_timer_wakeup(1 * 60L * 1000000L);
    esp_deep_sleep_start();
    Serial.print("...");
  } 
   if(WiFi.status() != WL_CONNECTED){
    ESP.restart();
    
   } 
   
  Blynk.begin(bAuth, MySSID, MyWifiPassword);
  
  Blynk.notify(" Geyser Automation is reconnected to Wifi !");
  
}

void loop() {
  ArduinoOTA.handle();
  
  if ( Blynk.connected()){
    Blynk.run();
    timer_updateplots.run();
    timer_T.run();

  }  
  else {  
    Blynk.connect(100);
    if ( !Blynk.connected())
        WifiCheck();
  }  
  
  client.loop();
  if (msgReceived == true) {
    
     msgReceived=false; 
     if ( statusValue == 1 )
      switchOnsendJsonToAWS ();
     else if (statusValue==0)
      switchOffsendJsonToAWS();  
     else // only duration received
      receivedDuration(); 
  }
    
}
