async = require("async")
express = require("express")
parseString = require("xml2js").parseString
bodyParser = require("body-parser")
sanitizeHtml = require("sanitize-html")
request = require("request")
qr = require("qr-image")

BasicHttpBinding = require("wcf.js").BasicHttpBinding
Proxy = require('wcf.js').Proxy
binding = new BasicHttpBinding({})

proxy = new Proxy(binding, process.env.BINDING_API)

app = express()

app.set("view engine", "jade")

app.use(bodyParser.urlencoded({extended:false}))

app.get("/", function (req, res) {
	
	getAllSoldiers(function (heroesList) {
		res.render("allHeroes", {heroesList: heroesList})
	})

})

app.get("/qrcodes", function (req, res) {
	getAllSoldiers(function (heroesList) {
		//loop through soldiers
		async.map(heroesList, function (hero, cb){
			console.log("generating qr code for:", hero)
			generateQrCode(hero.hash, function (qrCode) {

				cb()
			})
		}, function (err, results) {
			console.log("finished")
		})
		//call qr code gen on each soldier, with each callback saving to file
		//once complete, response 200
		res.send(200)
		//res.render("allHeroes", {heroesList: heroesList})
	})
})

function getAllSoldiers (cb) {
	message = '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Header></s:Header><s:Body><GetAllHeroPairs xmlns="http://tempuri.org/"></GetAllHeroPairs></s:Body></s:Envelope>'

	proxy.send(message, "http://tempuri.org/IService1/GetAllHeroPairs", function(response, ctx) {
		//console.log(ctx.statusCode)
		//console.log(response)
		if (ctx.statusCode == 500) {
			res.send(500)
		}
		else {
			parseString(response, function (err, result){
				heroes = result['s:Envelope']["s:Body"][0]["GetAllHeroPairsResponse"][0]["GetAllHeroPairsResult"][0]["a:HeroPair"]
				heroesList = []
				for (i = 0; i < heroes.length; i++) {
					heroesList.push( {
						name: heroes[i]["a:Name"][0],
						hash: heroes[i]["a:NameHashd"][0]
					})
				}
				//console.log(heroesList)
				cb(heroesList)
			})
		}
	})
}

app.get("/favicon.ico", function (req, res) {
	res.send(200)
})

app.get("/:heroId", function (req, res) {

	message = '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><GetRecordFromNameHash xmlns="http://tempuri.org/"><namehash>' + sanitizeHtml(req.params.heroId) + '</namehash></GetRecordFromNameHash></s:Body></s:Envelope>'
	proxy.send(message, "http://tempuri.org/IService1/GetRecordFromNameHash", function(response, ctx) {
		//console.log(ctx.statusCode)
		if (ctx.statusCode == 500) {
			res.send(500)
		}
		else {
			parseString(response, function (err, result){
				if (typeof result['s:Envelope']['s:Body'][0]['GetRecordFromNameHashResponse'][0]['GetRecordFromNameHashResult'][0]["a:NameHashd"][0] != "string") {
					res.send(404)
				}
				else {
					soldier = result['s:Envelope']['s:Body'][0]['GetRecordFromNameHashResponse'][0]['GetRecordFromNameHashResult'][0]
					newSoldier = {}
					keys = Object.keys(soldier)
					for (i = 1; i <= keys.length - 1; i++) {
						newKey = keys[i].replace("a:", "")
						newSoldier[newKey] = soldier[keys[i]][0]
					}
					delete newSoldier['CustomURL']
					newSoldier["DateOfDeath"] = (new Date(Date.parse(newSoldier["DateOfDeath"]))).toDateString()
					//console.log(newSoldier)
					res.render("hero", newSoldier)
				}
			})
		}
	})

})

app.get("/img/:heroid", function (req, res) {
	request.get("https://fieldofherosimageapi.azurewebsites.net/Service1.svc/images/" + req.params.heroid).pipe(res)
})


app.get("/qr/:heroID", function (req, res) {
	heroID = req.params.heroID

	generateQrCode (heroID, function (qrCode) {
		qrCode.pipe(res)
	})
})

function generateQrCode (heroID, cb) {
	qr_code = qr.image("http://fieldofheroesweb.azurewebsites.net/" + heroID)
	cb(qr_code)
}


console.log("listening")
app.listen(process.env.PORT || 5000)
