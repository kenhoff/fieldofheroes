express = require("express")
parseString = require("xml2js").parseString
bodyParser = require("body-parser")

BasicHttpBinding = require("wcf.js").BasicHttpBinding
Proxy = require('wcf.js').Proxy
binding = new BasicHttpBinding({})

proxy = new Proxy(binding, process.env.BINDING_API)

app = express()

app.use(bodyParser.urlencoded({extended:false}))

app.get("/:heroId", function (req, res) {

	console.log(req.params.heroId)

	message = '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><GetRecordFromHeroId xmlns="http://tempuri.org/"><HeroId>' + req.params.heroId + '</HeroId></GetRecordFromHeroId></s:Body></s:Envelope>'
	// TODO scrub this

	proxy.send(message, "http://tempuri.org/IService1/GetRecordFromHeroId", function(response, ctx) {
		console.log("got response")
		console.log(ctx.statusCode)
	      //console.log(response)
		parseString(response, function (err, result){
			soldier = result['s:Envelope']['s:Body'][0]['GetRecordFromHeroIdResponse'][0]['GetRecordFromHeroIdResult'][0]
			newSoldier = {}
			keys = Object.keys(soldier)
			//console.log(keys)
			for (i = 1; i <= keys.length - 1; i++) {
				//console.log(keys[i])
				newKey = keys[i].replace("a:", "")
				newSoldier[newKey] = soldier[keys[i]][0]
				//console.log(newSoldier)
			}
			delete newSoldier['CustomURL']
			//delete newSoldier['Success']
			//console.log("done with loop")
			console.log(newSoldier)
			res.json(newSoldier)
		})
	})
	console.log("sent message")

})









console.log("listening")
app.listen(process.env.PORT || 5000)
