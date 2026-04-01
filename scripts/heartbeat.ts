import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import webpush from 'web-push';

// --- CONFIGURATION ---
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// VAPID SETTINGS
const PUBLIC_KEY = 'BFOAoBwVZcK6EosPk4JLzDvT9g8bxmWQi9zdWsA075NzDIHT79bR5qfQXcNTjymmqdWvNIcZUc-sGbSnyX--Dl4';
const PRIVATE_KEY = 'JbUebLfEGZLj6NeKaX1vp4U6fCA61V-HQ2WcQavpbhk';
webpush.setVapidDetails('mailto:noreply@wassap-automation.com', PUBLIC_KEY, PRIVATE_KEY);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase credentials in environment.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const getFormattedTime = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();

async function runHeartbeat() {
  console.log(`[${new Date().toISOString()}] Starting Automation Heartbeat...`);

  // 1. Get Configuration (Gemini Key & Push Subscription)
  const [{ data: geminiConfig }, { data: pushConfig }] = await Promise.all([
    supabase.from('config').select('value').eq('id', 'gemini_api_key').single(),
    supabase.from('config').select('value').eq('id', 'push_subscription').single()
  ]);

  if (!geminiConfig?.value?.key) {
    console.error("Missing Gemini API Key in Supabase config.");
    return;
  }

  const genAI = new GoogleGenerativeAI(geminiConfig.value.key);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // 2. Fetch all chats
  const { data: chats, error: chatsError } = await supabase
    .from('chats')
    .select('*')
    .eq('is_group', false);

  if (chatsError || !chats) return;

  const now = new Date();
  const todayDateStr = now.toLocaleDateString('en-CA');
  const currentTimeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

  for (const chat of chats) {
    const automation = chat.automation;
    if (!automation?.enabled) continue;

    let triggeredContext = null;

    // --- TIME BASED ---
    for (const trigger of automation.timeTriggers || []) {
      if (trigger.lastTriggered === todayDateStr) continue;
      if (currentTimeStr >= trigger.startTime && currentTimeStr <= trigger.endTime) {
        if (Math.random() < 0.8) {
          trigger.lastTriggered = todayDateStr;
          triggeredContext = trigger.context;
          break;
        }
      }
    }

    // --- INACTIVITY ---
    if (!triggeredContext && automation.inactivity?.enabled) {
        const { data: lastMsgs } = await supabase.from('messages').select('*').eq('chat_id', chat.id).order('timestamp', { ascending: false }).limit(1);
        const lastMsg = lastMsgs?.[0];
        if (lastMsg && lastMsg.sender === 'me') {
            const msgTime = new Date(lastMsg.timestamp).getTime();
            const hoursSince = (Date.now() - msgTime) / (1000 * 60 * 60);
            if (hoursSince >= automation.inactivity.minHours) {
                if ((automation.lastInactivityTriggered || 0) < msgTime) {
                    if (hoursSince >= automation.inactivity.maxHours || Math.random() < 0.4) {
                        automation.lastInactivityTriggered = Date.now();
                        triggeredContext = "The user has been inactive for several hours. Send a friendly natural check-in message.";
                    }
                }
            }
        }
    }

    if (triggeredContext) {
      try {
        const { data: history } = await supabase.from('messages').select('*').eq('chat_id', chat.id).order('timestamp', { ascending: false }).limit(10);
        const formattedHistory = (history || []).reverse().map(m => `${m.sender === 'me' ? 'User' : chat.name}: ${m.text}`).join('\n');

        const systemPrompt = `You are ${chat.name}. Personality: ${chat.about || ''}. 
        CONTEXT: ${triggeredContext}
        LOG:
        ${formattedHistory}
        
        Generate 1 short WhatsApp message.`;

        const result = await model.generateContent(systemPrompt);
        const responseText = result.response.text().trim();

        if (responseText) {
            const aiMsg = { id: `${Date.now()}-cloud`, chat_id: chat.id, text: responseText, sender: 'other', timestamp: getFormattedTime(), status: 'delivered' };

            await supabase.from('messages').insert(aiMsg);
            await supabase.from('chats').update({ last_message: responseText, last_message_time: aiMsg.timestamp, automation }).eq('id', chat.id);

            // --- SEND WEB PUSH NOTIFICATION ---
            if (pushConfig?.value) {
                try {
                    await webpush.sendNotification(pushConfig.value, JSON.stringify({
                        title: chat.name,
                        body: responseText,
                        icon: chat.avatar,
                        tag: chat.id,
                        url: '/'
                    }));
                } catch (pushErr) {
                    console.error("Push delivery failed:", pushErr);
                }
            }

            console.log(`Cloud response & Push sent for ${chat.name}`);
        }
      } catch (err) { console.error(err); }
    }
  }
  console.log("Heartbeat cycle complete.");
}

runHeartbeat().catch(err => { console.error(err); process.exit(1); });
