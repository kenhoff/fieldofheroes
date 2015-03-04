express = require("express")
parseString = require("xml2js").parseString
bodyParser = require("body-parser")
sanitizeHtml = require("sanitize-html")

BasicHttpBinding = require("wcf.js").BasicHttpBinding
Proxy = require('wcf.js').Proxy
binding = new BasicHttpBinding({})

proxy = new Proxy(binding, process.env.BINDING_API)

app = express()

app.set("view engine", "jade")

app.use(bodyParser.urlencoded({extended:false}))

app.get("/", function (req, res) {
	res.send(200)
})

app.get("/favicon.ico", function (req, res) {
	res.send(200)
})

app.get("/:heroId", function (req, res) {

	message = '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><GetRecordFromNameHash xmlns="http://tempuri.org/"><namehash>' + sanitizeHtml(req.params.heroId) + '</namehash></GetRecordFromNameHash></s:Body></s:Envelope>'
	proxy.send(message, "http://tempuri.org/IService1/GetRecordFromNameHash", function(response, ctx) {
		console.log(ctx.statusCode)
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
					res.render("hero", newSoldier)
				}
			})
		}
	})

})









console.log("listening")
app.listen(process.env.PORT || 5000)
