var restify = require('restify');
var builder = require('botbuilder');
var env = require('node-env-file');
var https = require('https');
var http = require('http');

var express = require('express');
var app = express();
var path = require('path');

// viewed at http://localhost:8080
app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});

env(__dirname + '/.env');

//=========================================================
// Bot Setup
//=========================================================
// Setup Restify Server
var server = restify.createServer();

app.set('port', (process.env.PORT || 5000));

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

// server.listen(process.env.port || process.env.PORT || 3978, function () {
   // console.log('%s listening to %s', server.name, server.url); 
// });


// Create chat bot
// var connector = new builder.ChatConnector({
    // appId: "c230e4e1-42b9-4a35-b30e-e024908950a5",
    // appPassword: "n7YkXwbnn5hp59WKESPe0em"
// });

var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

app.post('/api/messages', connector.listen());

// var bot = new builder.UniversalBot(connector, function(session){
	// session.send("Welcome to the Movie.io bot, I can help you with finding lots of things about following!!");
	// session.beginDialog('selectOption');
// });

var bot = new builder.UniversalBot(connector);


var optionData = {
    "Movies": {
        id: 1,
        category: "Movie"
    },
    "TV Shows": {
        id: 2,
        category: "TV Show"
    },
    "Celebrity": {
        id: 3,
        category: "Celebrity"
    },
	"Movies in Theater Now": {
        id: 4,
        category: "Movies in Theater Now"
    },
	"Popular Movies": {
        id: 5,
        category: "Popular Movies"
    }
};

bot.dialog('/', [
    function (session, args, next) {
        if (!session.userData.name) {
            session.beginDialog('/profile');
        } else {
            next();
        }
    },
    function (session, results) {
        session.send('Hello %s!', session.userData.name);
		session.send("Welcome to the Movie.io bot, I can help you with finding detail on following!!");
		session.beginDialog('selectOption');
    }
]);

bot.dialog('/profile', [
    function (session) {
        builder.Prompts.text(session, 'Hi! What is your name?');
    },
    function (session, results) {
        session.userData.name = results.response;
        session.endDialog();
    }
]);


bot.dialog('selectOption', [
	function(session)  
	{  
		builder.Prompts.choice(session, "What would you like to search for? (please enter option e.g. 1/2/3)", optionData, {
            maxRetries: 2,
            retryPrompt: 'Ooops, what you wrote is not a valid option, please try again'
        });
	},
	function (session, results, next) {
        if (results.response) {
			if(optionData[results.response.entity]){
				var selectedOption = optionData[results.response.entity];
				session.dialogData.selectedOption = selectedOption;
				if(optionData[results.response.entity].id == 4 || optionData[results.response.entity].id == 5) {
					next();
				} else {
					session.send('Please type %(category)s name, you would like to know about.',selectedOption);
					builder.Prompts.text(session, '');					
				}
			} else {
				session.send("ok");
			}
        } else {
            session.send("ok");
        }
    },
	function (session, results) {
		var apiKey = process.env.API_KEY_MOVIEDB;
		var selectedOption = session.dialogData.selectedOption.category;
		var selectedOptionId = session.dialogData.selectedOption.id;
		var url = "";
		
		if(selectedOption == 'Celebrity'){
			url = process.env.MOVIE_DB_URL+"search/person?api_key="+apiKey+"&query="+results.response;
		} else if(selectedOptionId == 4){
			var d = new Date();
			var newDate = new Date();
			newDate.setDate(newDate.getDate() - 15);

			var to_date = d.getFullYear()+'-'+(parseInt(d.getMonth())+1)+'-'+d.getDate();
			var from_date = newDate.getFullYear()+'-'+(parseInt(newDate.getMonth())+1)+'-'+newDate.getDate();
			url = process.env.MOVIE_DB_URL+"discover/movie?primary_release_date.gte="+from_date+"&primary_release_date.lte="+to_date+"&api_key="+apiKey;
		} else if(selectedOptionId == 5){
			url = process.env.MOVIE_DB_URL+"discover/movie?sort_by=popularity.desc&api_key="+apiKey;
		} else {
			url = process.env.MOVIE_DB_URL+"search/movie?api_key="+apiKey+"&query="+results.response;
		}
		
		session.sendTyping();
		
		https.get(url, function(res) {
		  //console.log(res);
		  var body = '';
		  res.on('data', function(data){
			body += data;
		  });
		  // After the response is completed, parse it
		  res.on('end', function() {
			var parsed = JSON.parse(body);
			console.log(parsed.results);
			var isDataPresent = false;
			var result_lenth = parsed.results.length;
			
			
			if(result_lenth >= 1){
				isDataPresent = true;
			}
			
			if(result_lenth > 1){
				session.send("Found %d results.",result_lenth);
			} else if(result_lenth == 0){
				session.send("Result not found for *%s* :(.",results.response);
			}
			
			if(isDataPresent == true) {
				var id;
				var name;
				var desc;
				var release_date;
				var poster;
				
				if(selectedOption != 'Celebrity'){
					var knowMore = process.env.KNOW_MORE_URL;
					if(result_lenth == 1) {
						var i = 0;
						id = parsed.results[i].id;
						name = parsed.results[i].original_title;
						desc = parsed.results[i].overview;
						release_date = parsed.results[i].release_date;
						if(parsed.results[i].poster_path!=null){
							poster = "https://image.tmdb.org/t/p/w640"+parsed.results[i].poster_path;
						} else {
							poster = process.env.NO_IMAGE_URL;
						}
						
						var msg = new builder.Message(session)
						.textFormat(builder.TextFormat.xml)
						.attachments([
							new builder.HeroCard(session)
								.title(name)
								.subtitle("Release Date: "+release_date)
								.text(desc)
								.images([
									builder.CardImage.create(session,poster)
								])
								.tap(builder.CardAction.openUrl(session, knowMore+id))
								.buttons([
									builder.CardAction.openUrl(session, knowMore+id, 'Know More')
								])
						]);
						session.send(msg);
					} else {
						var arrayOfResult = [];
						if(result_lenth > 5){
							result_lenth = 5;
						}
						for(var i=0;i<result_lenth;i++) {
							id = parsed.results[i].id;
							name = parsed.results[i].original_title;
							desc = parsed.results[i].overview;
							release_date = parsed.results[i].release_date;
							if(parsed.results[i].poster_path!=null){
								poster = "https://image.tmdb.org/t/p/w640"+parsed.results[i].poster_path;
							} else {
								poster = process.env.NO_IMAGE_URL;
							}
							
							 arrayOfResult.push(
								new builder.ThumbnailCard(session)
									.title(name)
									.subtitle("Release Date: "+release_date)
									.text(desc.substr(0,200))
									.images([
										builder.CardImage.create(session,poster)
									])
									.tap(builder.CardAction.openUrl(session, knowMore+id))
									.buttons([
										builder.CardAction.openUrl(session, knowMore+id, 'Know More')
									])
							);
							//session.send(msg);
						}
						
						 // create reply with Carousel AttachmentLayout
						var reply = new builder.Message(session)
						.attachmentLayout(builder.AttachmentLayout.carousel)
						.attachments(arrayOfResult);
						session.send(reply);
					}
				} else {
					var knowMore = process.env.KNOW_MORE_PERSON_URL;
					if(result_lenth == 1) {
						var i = 0;
						id = parsed.results[i].id;
						name = parsed.results[i].name;
						if(parsed.results[i].profile_path!=null){
							poster = "https://image.tmdb.org/t/p/w640"+parsed.results[i].profile_path;
						} else {
							poster = process.env.NO_IMAGE_URL;
						}
						
						var msg = new builder.Message(session)
						.textFormat(builder.TextFormat.xml)
						.attachments([
							new builder.HeroCard(session)
								.title(name)
								.images([
									builder.CardImage.create(session,poster)
								])
								.tap(builder.CardAction.openUrl(session, knowMore+id))
								.buttons([
									builder.CardAction.openUrl(session, knowMore+id, 'Know More')
								])
						]);
						session.send(msg);
					} else {
						var arrayOfResult = [];
						for(var i=0;i<result_lenth;i++) {
							id = parsed.results[i].id;
							name = parsed.results[i].name;
							if(parsed.results[i].profile_path!=null){
								poster = "https://image.tmdb.org/t/p/w640"+parsed.results[i].profile_path;
							} else {
								poster = process.env.NO_IMAGE_URL;
							}

							 arrayOfResult.push(
								new builder.HeroCard(session)
									.title(name)
									.images([
										builder.CardImage.create(session,poster)
									])
									.tap(builder.CardAction.openUrl(session, knowMore+id))
									.buttons([
										builder.CardAction.openUrl(session, knowMore+id, 'Know More')
									])
							);
							//session.send(msg);
						}
						
						 // create reply with Carousel AttachmentLayout
						var reply = new builder.Message(session)
						.attachmentLayout(builder.AttachmentLayout.carousel)
						.attachments(arrayOfResult);
						session.send(reply);
					}
				}
			}
		  });
		})
		//send error to user
		.on('error', function(e) {
		  session.send(e.message);
		});
    }
]);