if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) {
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

importScripts('/common/Uploaded%20files/Code/PDF/pdfkit.standalone.js')
importScripts('/common/Uploaded%20files/Code/PDF/blob-stream.js')

onmessage = function(e) {
    const data = e.data;
    const type = data.type;
    const arg = data.arg;
    // console.log('Message received from main script');
    switch (type) {
      case 'MakeCert':
        // console.log('Posting message back to main script');
        // generate CSVdata
        eventid = arg[0];
        userid = arg[1];
        token = arg[2];
        postMessage({
          type: type,
          data: startProcess(eventid, userid, token),
        });
        break;
      default:
        console.error('invalid type passed in');
        break;
    }
}

function createCert() {
  const doc = new PDFDocument({
    margins: {
      top: 40,
      bottom: 40,
      left: 40,
      right: 40
    },
    layout: "landscape"
  });
  const stream = doc.pipe(blobStream());
  // do content
  //get header image in arraybuffer

  //do rest
  doc.image('/common/Uploaded%20files/Code/PDF/Header.png', 15, 15, {width: 300});
  doc.font('Times-Roman').text('Certificate of Attendence').moveDown(0.5);
  doc.font('Times-Roman').text('Firstname Lastname').moveDown(0.5);
  doc.font('Times-Roman').text('attended the').moveDown(0.5);
  doc.font('Times-Roman').text('Eventname').moveDown(0.5);
  doc.font('Times-Roman').text('on').moveDown(0.5);
  doc.font('Times-Roman').text('DATES').moveDown(0.5);
  doc.font('Times-Roman').text('of CPD hours duration').moveDown(0.5);

  // Get blob
  doc.end();
  var blob = null;
  stream.on('finish', function() {
  // get a blob you can do whatever you like with
    blob = stream.toBlob('application/pdf');
  });
  return blob;
}


function exportlog(s) {
  postMessage({
    type: "certlog",
    data: s,
  });
}

function dorequest(url, func, errfunc = null, type=null) {
  var xhr = new XMLHttpRequest();
  if (type != null) { xhr.responseType = "arraybuffer"; }
  xhr.open('GET', url, false);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('RequestVerificationToken', token);
  xhr.onload = function() {
    if (xhr.status === 200) {
      if (type == null) { func(JSON.parse(xhr.responseText)); }
      else { func(xhr.reponseText); }
    }
    else {
      if (errfunc) { errfunc(xhr.responseText); }
      else { exportlog("Request error ({0}). {1}".format(url, xhr.responseText)); }
    }
  };
  xhr.send();
}

function getName(pid) {
  var name = "";
  dorequest("/api/PartySummary/{0}".format(pid), function(data) {
      name = data["Name"];
  });
  return name;
}

function startProcess(eventid, userid, token) {
  // Steps to genrate PDF
  // Get Event date(s) and title
  var start = null;
  var end = null;
  var name = null;
  dorequest("/api/Event/{0}".format(eventid),
    function(eventdata) {
      if (eventdata["StartDateTime"]) { start = eventdata["StartDateTime"]; }
      if (eventdata["EndDateTime"]) { end = eventdata["EndDateTime"]; }
  });
  // Get user registration for hours
  var orderid = null;
  dorequest("/api/EventRegistration/{0}-{1}".format(eventid, userid),
    function(regdata) {
      if (regdata["AdditionalAttributes"] && regdata["AdditionalAttributes"]["$values"]) {
        regdata["AdditionalAttributes"]["$values"].forEach(function(data){
          if (data["Name"] == "AssociatedInvoiceId") { orderid = data["Value"]; }
        });
      }
      if (regdata["Registrant"] && regdata["Registrant"]["PersonName"]) {
        name = "{0} {1}".format(regdata["Registrant"]["PersonName"]["FirstName"],
          regdata["Registrant"]["PersonName"]["LastName"]);
      } else { UNKNOWNPERSON; }
  });
  var ceu = null;
  dorequest("/api/Order_Lines?ORDER_NUMBER={0}".format(orderid), function(orderdata) {
    if (orderdata["TotalCount"] != 1) {
      TOOMANYORDERS
    }
    else {
      orderdata["Items"]["$values"][0]["Properties"].forEach(function(odata) {
        if (odata["Name"] == "CEU_AWARDED") {ceu = odata["Value"]["$value"]; }
      });
    }
  });

  return [createCert(), eventid, name];
}
