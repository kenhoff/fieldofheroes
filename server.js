async = require("async")
express = require("express")
parseString = require("xml2js").parseString
bodyParser = require("body-parser")
sanitizeHtml = require("sanitize-html")
request = require("request")
qr = require("qr-image")
fs = require("graceful-fs")
archiver = require("archiver")
mkdirp = require("mkdirp")
timeout = require("connect-timeout")

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

app.get("/generate", timeout("600s"), function (req, res) {
	res.send(200)
	getAllSoldiers(function (heroesList) {
		//loop through soldiers
		mkdirp(__dirname + "/qrcodes", function (err) {
			if (err) { console.log(err) }
			async.mapLimit(heroesList.slice(0,10000), 10, function (hero, cb){
			//async.mapLimit(heroesList, 10, function (hero, cb){
				console.log("generating qr code for:", hero)
				generateQrCode(hero.hash, function (qrCode) {
					initialDateString = hero.DoD.split(" ")[0].split("/")
					year = initialDateString[2]
					day = initialDateString[1]
					if (day <= 9) {
						day = "0" + day
					}
					month = initialDateString[0]
					if (month <= 9) {
						month = "0" + month
					}
					dateString = [year, month, day].join("-")
					lastNameString = hero.name.split(",")[0]

					fileString = dateString + "-" + lastNameString
					console.log(fileString)
					qrPipe = qrCode.pipe(fs.createWriteStream(__dirname + "/qrcodes/" + fileString + ".png"))
					console.log("qrpipe created")
					qrPipe.on('close', function () {
						console.log("pipe finished")
						cb(null)
					})
				})
			}, function (err, results) {
				console.log("done generating qr codes")
				zipFile = archiver("zip")

				output = fs.createWriteStream(__dirname + "/qrcodes.zip")
				console.log("created write stream")
				output.on('close', function () {
					console.log("output closed")
				})
				console.log("created close event callback")


				zipFile.pipe(output)
				console.log("told zipfile to pipe to output")


				zipFile.bulk([{src: ["qrcodes/*.png"]}]).finalize()
				console.log("told zipfile to zip qrcodes directory and finalize")

			})
		})
	})
})

app.get("/qrcodes", function (req, res) {
	res.sendFile(__dirname + "/qrcodes.zip")

})

function getAllSoldiers (cb) {
	message = '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Header></s:Header><s:Body><GetAllHeroPairs xmlns="http://tempuri.org/"></GetAllHeroPairs></s:Body></s:Envelope>'

	proxy.send(message, "http://tempuri.org/IService1/GetAllHeroPairs", function(response, ctx) {
		//console.log(ctx.statusCode)
		//console.log(response)
		if (ctx.statusCode == 500) {
			res.sendStatus(500)
		}
		else {
			parseString(response, function (err, result){
				heroes = result['s:Envelope']["s:Body"][0]["GetAllHeroPairsResponse"][0]["GetAllHeroPairsResult"][0]["a:HeroPair"]
				heroesList = []
				for (i = 0; i < heroes.length; i++) {
					//console.log(heroes[i])
					heroesList.push( {
						name: heroes[i]["a:Name"][0],
						hash: heroes[i]["a:NameHashd"][0],
						DoD: heroes[i]["a:DoD"][0]
					})
				}
				//console.log(heroesList)
				cb(heroesList)
			})
		}
	})
}

app.get("/favicon.ico", function (req, res) {
	res.sendStatus(200)
})

app.get("/:heroId", function (req, res) {

	message = '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><GetRecordFromNameHash xmlns="http://tempuri.org/"><namehash>' + sanitizeHtml(req.params.heroId) + '</namehash></GetRecordFromNameHash></s:Body></s:Envelope>'
	proxy.send(message, "http://tempuri.org/IService1/GetRecordFromNameHash", function(response, ctx) {
		console.log(ctx.statusCode)
		if (ctx.statusCode == 500) {
			res.sendStatus(500)
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
					//delete newSoldier['CustomURL']
					newSoldier["DateOfDeath"] = (new Date(Date.parse(newSoldier["DateOfDeath"]))).toDateString()
					console.log(newSoldier)
					if (newSoldier["CustomPage"] == "true") {
						console.log("redirecting to", newSoldier["CustomURL"])
						res.redirect(newSoldier["CustomURL"])
					}
					else {
						res.render("hero", newSoldier)
					}
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
	qr_code = qr.image("http://fieldofheroesweb.azurewebsites.net/" + heroID, {type: "png"})
	cb(qr_code)
}


console.log("listening")
app.listen(process.env.PORT || 5000)
