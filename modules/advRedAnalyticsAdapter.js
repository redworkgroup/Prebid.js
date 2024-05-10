import {generateUUID, logInfo} from '../src/utils.js'
import {ajaxBuilder} from '../src/ajax.js'
import adapter from '../libraries/analyticsAdapter/AnalyticsAdapter.js'
import adapterManager from '../src/adapterManager.js'
import {EVENTS} from '../src/constants.js'
import {getRefererInfo} from '../src/refererDetection.js';

/**
 * advRedAnalyticsAdapter.js - analytics adapter for AdvRed
 */
const DEFAULT_EVENT_URL = 'https://analytics-api.advred.com/endpoint'

let ajax = ajaxBuilder(10000)
let pwId
let initOptions
let flushInterval
let queue = []

let advRedAnalytics = Object.assign(adapter({url: DEFAULT_EVENT_URL, analyticsType: 'endpoint'}), {
  track({eventType, args}) {
    handleEvent(eventType, args)
  }
})

function sendEvents() {
  if (queue.length > 0) {
    const message = {
      pwId: pwId,
      publisherId: initOptions.publisher_id,
      events: queue,
      pageUrl: getRefererInfo().page
    }
    queue = []

    const url = initOptions.url ? initOptions.url : DEFAULT_EVENT_URL
    ajax(
      url,
      () => logInfo("AdvRed Analytics sent " + queue.length + " events"),
      JSON.stringify(message),
      {
        method: 'POST',
        contentType: 'application/json',
        withCredentials: true
      }
    )
  }
}

function convertAdUnit(adUnit) {
  if (!adUnit) return adUnit

  const shortAdUnit = {}
  shortAdUnit.code = adUnit.code
  shortAdUnit.sizes = adUnit.sizes
  return shortAdUnit
}

function convertBid(bid) {
  if (!bid) return bid

  const shortBid = {}
  shortBid.auctionId = bid.auctionId
  shortBid.bidder = bid.bidder
  shortBid.bidderRequestId = bid.bidderRequestId
  shortBid.bidId = bid.bidId
  shortBid.crumbs = bid.crumbs
  shortBid.cpm = bid.cpm
  shortBid.currency = bid.currency
  shortBid.mediaTypes = bid.mediaTypes
  shortBid.sizes = bid.sizes
  shortBid.transactionId = bid.transactionId
  shortBid.adUnitCode = bid.adUnitCode
  shortBid.bidRequestsCount = bid.bidRequestsCount
  shortBid.serverResponseTimeMs = bid.serverResponseTimeMs
  return shortBid
}

function convertRequest(request) {
  if (!request) return request

  const shortRequest = {}
  shortRequest.auctionId = request.auctionId
  shortRequest.auctionStart = request.auctionStart
  shortRequest.bidderRequestId = request.bidderRequestId
  shortRequest.bidderCode = request.bidderCode
  shortRequest.bids = request.bids && request.bids.map(convertBid)

  return shortRequest
}

function convertAuctionInit(origEvent) {
  let shortEvent = {}
  shortEvent.auctionId = origEvent.auctionId
  shortEvent.timeout = origEvent.timeout
  shortEvent.adUnits = origEvent.adUnits && origEvent.adUnits.map(convertAdUnit)
  shortEvent.bidderRequests = origEvent.bidderRequests && origEvent.bidderRequests.map(convertRequest)
  return shortEvent
}

function convertAuctionEnd(origEvent) {
  let shortEvent = {}
  shortEvent.auctionId = origEvent.auctionId
  shortEvent.end = origEvent.end
  shortEvent.start = origEvent.start
  shortEvent.adUnitCodes = origEvent.adUnitCodes
  shortEvent.bidsReceived = origEvent.bidsReceived && origEvent.bidsReceived.map(convertBid)
  return shortEvent
}

function convertBidTimeout(origEvent) {
  let shortEvent = {}
  shortEvent.bidders = origEvent && origEvent.map ? origEvent.map(convertBid) : origEvent
  return shortEvent
}

function convertBidRequested(origEvent) {
  let shortEvent = {}
  shortEvent.auctionId = origEvent.auctionId
  shortEvent.bidderCode = origEvent.bidderCode
  shortEvent.doneCbCallCount = origEvent.doneCbCallCount
  shortEvent.start = origEvent.start
  shortEvent.bidderRequestId = origEvent.bidderRequestId
  shortEvent.bids = origEvent.bids && origEvent.bids.map(convertBid)
  shortEvent.auctionStart = origEvent.auctionStart
  shortEvent.timeout = origEvent.timeout
  return shortEvent
}

function convertBidResponse (origEvent) {
  let shortEvent = {}
  shortEvent.bidderCode = origEvent.bidderCode
  shortEvent.width = origEvent.width
  shortEvent.height = origEvent.height
  shortEvent.adId = origEvent.adId
  shortEvent.mediaType = origEvent.mediaType
  shortEvent.cpm = origEvent.cpm
  shortEvent.currency = origEvent.currency
  shortEvent.requestId = origEvent.requestId
  shortEvent.timeToRespond = origEvent.timeToRespond
  shortEvent.requestTimestamp = origEvent.requestTimestamp
  shortEvent.responseTimestamp = origEvent.responseTimestamp
  shortEvent.netRevenue = origEvent.netRevenue
  shortEvent.size = origEvent.size
  return shortEvent
}

function convertBidWon(origEvent) {
  let shortEvent = {}
  shortEvent.adId = origEvent.adId
  shortEvent.adUnitCode = origEvent.adUnitCode
  shortEvent.bidderCode = origEvent.bidderCode
  shortEvent.height = origEvent.height
  shortEvent.mediaType = origEvent.mediaType
  shortEvent.netRevenue = origEvent.netRevenue
  shortEvent.cpm = origEvent.cpm
  shortEvent.requestTimestamp = origEvent.requestTimestamp
  shortEvent.responseTimestamp = origEvent.responseTimestamp
  shortEvent.size = origEvent.size
  shortEvent.width = origEvent.width
  shortEvent.currency = origEvent.currency
  shortEvent.bidder = origEvent.bidder
  return shortEvent
}

function convertBidderDone(origEvent) {
  let shortEvent = {}
  shortEvent.auctionStart = origEvent.auctionStart
  shortEvent.bidderCode = origEvent.bidderCode
  shortEvent.bidderRequestId = origEvent.bidderRequestId
  shortEvent.bids = origEvent.bids && origEvent.bids.map(convertBid)
  shortEvent.doneCbCallCount = origEvent.doneCbCallCount
  shortEvent.start = origEvent.start
  shortEvent.timeout = origEvent.timeout
  shortEvent.tid = origEvent.tid
  shortEvent.src = origEvent.src
  return shortEvent
}

function handleEvent(eventType, origEvent) {
  try {
    origEvent = origEvent ? JSON.parse(JSON.stringify(origEvent)) : {}
  } catch (e) {
  }

  let shortEvent

  switch (eventType) {
    case EVENTS.AUCTION_INIT: {
      shortEvent = convertAuctionInit(origEvent)
      break
    }
    case EVENTS.AUCTION_END: {
      shortEvent = convertAuctionEnd(origEvent)
      break
    }
    case EVENTS.BID_TIMEOUT: {
      shortEvent = convertBidTimeout(origEvent)
      break
    }
    case EVENTS.BID_REQUESTED: {
      shortEvent = convertBidRequested(origEvent)
      break
    }
    case EVENTS.BID_RESPONSE: {
      shortEvent = convertBidResponse(origEvent)
      break
    }
    case EVENTS.BID_WON: {
      shortEvent = convertBidWon(origEvent)
      break
    }
    case EVENTS.BIDDER_DONE: {
      shortEvent = convertBidderDone(origEvent)
      break
    }
    default:
      return
  }

  shortEvent.eventType = eventType
  shortEvent.auctionId = origEvent.auctionId
  shortEvent.adUnitCode = origEvent.adUnitCode
  shortEvent.timestamp = origEvent.timestamp || Date.now()

  sendEvent(shortEvent)
}

function sendEvent(event) {
  queue.push(event)

  if (event.eventType === EVENTS.AUCTION_END) {
    sendEvents()
  }
}

advRedAnalytics.originEnableAnalytics = advRedAnalytics.enableAnalytics
advRedAnalytics.enableAnalytics = function (config) {
  initOptions = config.options || {}
  pwId = generateUUID()
  flushInterval = setInterval(sendEvents, 1000)

  advRedAnalytics.originEnableAnalytics(config)
}

advRedAnalytics.originDisableAnalytics = advRedAnalytics.disableAnalytics
advRedAnalytics.disableAnalytics = function () {
  clearInterval(flushInterval)
  sendEvents()
  advRedAnalytics.originDisableAnalytics()
}

adapterManager.registerAnalyticsAdapter({
  adapter: advRedAnalytics,
  code: 'advRed'
})

advRedAnalytics.getOptions = function () {
  return initOptions
}

advRedAnalytics.sendEvents = sendEvents

export default advRedAnalytics
