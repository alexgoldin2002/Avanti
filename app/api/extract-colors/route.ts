import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageUrl, imageBase64 } = body

    let imageSource: any

    if (imageBase64) {
      const mediaType = imageBase64.startsWith('data:image/png') ? 'image/png' :
                        imageBase64.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg'
      const base64Data = imageBase64.split(',')[1]
      if (!base64Data) return NextResponse.json({ colors: [] })
      imageSource = { type: 'base64', media_type: mediaType, data: base64Data }
    } else if (imageUrl) {
      imageSource = { type: 'url', url: imageUrl }
    } else {
      return NextResponse.json({ colors: [] })
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: imageSource },
          {
            type: 'text',
            text: `Look at this image. What are the 2-3 most dominant colors? 
            
Create 7 UI card color objects inspired by those dominant colors as a gentle ombré.
Each card background should be very pale (mix color with 90% white).

You MUST return ONLY a raw JSON array. No explanation. No markdown. No code blocks. Start your response with [ and end with ]

Example format:
[{"bg":"#fef9e7","border":"#f9e79f","numBg":"#d4ac0d","numText":"#ffffff","titleColor":"#7d6608","subColor":"#9a7d0a"},{"bg":"#fef5e4","border":"#f8c471","numBg":"#e67e22","numText":"#ffffff","titleColor":"#784212","subColor":"#935116"},{"bg":"#fbeee0","border":"#f0a16a","numBg":"#ca6f1e","numText":"#ffffff","titleColor":"#6e2f1a","subColor":"#873600"},{"bg":"#f9ebea","border":"#f1948a","numBg":"#c0392b","numText":"#ffffff","titleColor":"#641e16","subColor":"#7b241c"},{"bg":"#f4ecf7","border":"#c39bd3","numBg":"#8e44ad","numText":"#ffffff","titleColor":"#4a235a","subColor":"#6c3483"},{"bg":"#eaf2ff","border":"#85c1e9","numBg":"#2e86c1","numText":"#ffffff","titleColor":"#1a5276","subColor":"#1f618d"},{"bg":"#e8f8f5","border":"#76d7c4","numBg":"#1abc9c","numText":"#ffffff","titleColor":"#0e6655","subColor":"#117a65"}]

Now create 7 colors for THIS specific image following the same format. Return ONLY the JSON array.`
          }
        ]
      }]
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ colors: [] })
    }

    const text = content.text.trim()
    console.log('Claude raw response:', text.substring(0, 200))
    
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('No JSON array found in:', text)
      return NextResponse.json({ colors: [] })
    }

    const colors = JSON.parse(jsonMatch[0])
    
    if (!Array.isArray(colors) || colors.length === 0) {
      return NextResponse.json({ colors: [] })
    }

    const padded = colors.length >= 7 ? colors : [
      ...colors,
      ...Array(7 - colors.length).fill(colors[colors.length - 1])
    ]

    return NextResponse.json({ colors: padded.slice(0, 7) })

  } catch (e: any) {
    console.error('Extract colors error:', e.message)
    return NextResponse.json({ colors: [] })
  }
}
