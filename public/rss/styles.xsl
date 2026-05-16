<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/"
                xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml" lang="en">
      <head>
        <title><xsl:value-of select="/rss/channel/title"/> - RSS Feed</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
        <style type="text/css">
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            background-color: #f6f3ee;
          }
          .header {
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #ccc;
          }
          h1 {
            color: #111;
            margin-bottom: 0.5rem;
          }
          .description {
            color: #666;
            font-size: 1.1rem;
          }
          .notice {
            background-color: #e9ecef;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 2rem;
            font-size: 0.95rem;
          }
          .item {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            margin-bottom: 1.5rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          .item h2 {
            margin-top: 0;
            margin-bottom: 0.5rem;
          }
          .item h2 a {
            color: #2f6765;
            text-decoration: none;
          }
          .item h2 a:hover {
            text-decoration: underline;
          }
          .meta {
            font-size: 0.85rem;
            color: #777;
            margin-bottom: 1rem;
            font-family: monospace;
          }
          .content {
            font-size: 1rem;
          }
        </style>
      </head>
      <body>
        <div class="notice">
          <strong>This is an RSS feed.</strong> You can subscribe to it using an RSS reader like Feedly, Inoreader, or Apple News to get updates when new content is published.
        </div>
        
        <div class="header">
          <h1><xsl:value-of select="/rss/channel/title"/></h1>
          <p class="description"><xsl:value-of select="/rss/channel/description"/></p>
          <a href="/vibhordubey/">Visit Website &#x2192;</a>
        </div>

        <div class="items">
          <xsl:for-each select="/rss/channel/item">
            <div class="item">
              <h2>
                <a href="{link}">
                  <xsl:value-of select="title"/>
                </a>
              </h2>
              <div class="meta">
                Published: <xsl:value-of select="pubDate"/>
              </div>
              <div class="content">
                <xsl:value-of select="description" disable-output-escaping="yes"/>
              </div>
            </div>
          </xsl:for-each>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>