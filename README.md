# Nostr Smart Widget Previewer

A boiler plate to start building dynamic nostr smart widgets

## Installation

```bash
npm install
npm run dev
```

## Dependencies

- axios
- canvas
- cors
- express
- nostr-tools
- puppeteer
- smart-widget-builder
- ws

## example
This is an example of a smart widget starting point that sends back a nostr event of a valid signed smart widget
```js

/*
Root endpoint, should be the start of the smart widget.
Add more endpoints to use them in a POST type buttons for more widget heirarchy.
*/
router.post("/", async (req, res) => {
  try {
    /*
      Initialize a Smart Widget instance, a relays URL list is optional.
      Make sure to add your secret key in the .env file under the key of SECRET_KEY to ensure all widgets are signed under the same key.
    */
    let SMART_WIDGET = new SW();

    /*
     Smart widget components (Image, Input, Button).
     */
    let SWImage = new Image(
      "https://yakihonne.s3.ap-east-1.amazonaws.com/sw-v2/dad-jokes.png"
    );
    let SWButton = new Button(
      1,
      "Give me a joke 😁",
      "post",
      getMainURL() + "/joke"
    );

    /*
    Smart widget component set, it accepts one image, one optional input, and a max of 6 buttons ordered respectively from 1 to 6.
    */
    let SWComp = new SWComponentsSet([SWImage, SWButton]);

    /*
    An optional static Smart widget event identifier, but highly recommended on the root Smart widget.
    Make sure to use a unique string.
    */
    let identifier = "a99a8857ce9ca5a4237";

    /*
    To sign a Smart widget event, skip this step if wanting to publish the event.
    */
    let signedEvent = await SMART_WIDGET.signEvent(
      SWComp,
      "Funny jokes",
      identifier
    );

    /*
    To publish a Smart widget event, skip this step if not wanting to publish the event.
    For a best practice, make sure to publish only the root widget.
    the init() method is required before publishing the Smart widget.
    */
    let publishedEvent;
    if (process.env.NODE_ENV === "production")
      publishedEvent = await SMART_WIDGET.publish(SWComp, "Funny jokes", identifier);

     /*
    Always return a valid Smart widget event.
    */
    res.send(publishedEvent ? publishedEvent.event : signedEvent.event);
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "Server error" });
  }
});
```

## General
- All endpoints should always return a valid smart widget event
- All endpoints except for the starting endpoint should not be published for fast response and avoid unnecessary event publishing