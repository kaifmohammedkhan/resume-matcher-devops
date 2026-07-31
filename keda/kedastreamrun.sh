#!/bin/bash

NATS_SERVER="localhost:4223"
# Give the port-forwarding tunnel a brief moment to settle
echo "Waiting 2 seconds for port-forwarding channels to settle..."
sleep 2

echo "----------------------------------------"
# Step 1: Create the Stream
echo "➡️ Step 1: Creating NATS Stream 'RESUMES'..."
if ! nats stream add RESUMES \
  --subjects "RESUMES.*" \
  --storage memory \
  --retention limits \
  --max-msgs=-1 \
  --max-bytes=-1 \
  --max-age=-1 \
  --max-msg-size=-1 \
  --discard old \
  --dupe-window 2m \
  --server="$NATS_SERVER"; then
    echo "❌ Error: Step 1 failed! Could not create stream 'RESUMES'." >&2
    exit 1
fi
echo "✅ Step 1 Successful: Stream 'RESUMES' verified/created."

echo "----------------------------------------"

# Step 2: Create the Consumer
echo "➡️ Step 2: Creating Pull Consumer 'resume-parser'..."
if ! nats consumer add RESUMES resume-parser \
  --pull \
  --deliver all \
  --ack explicit \
  --replay instant \
  --max-deliver=-1 \
  --server="$NATS_SERVER"; then
    echo "❌ Error: Step 2 failed! Could not create consumer 'resume-parser'." >&2
    exit 1
fi
echo "✅ Step 2 Successful: Consumer 'resume-parser' verified/created."

echo "----------------------------------------"

# Step 3: Publish Messages
echo "➡️ Step 3: Publishing 10 test messages..."
for i in {1..10}
do
   if ! nats pub RESUMES.test "hello message $i" --server="$NATS_SERVER"; then
       echo "❌ Error: Failed to publish message $i. Stopping loop." >&2
       exit 1
   fi
   sleep 0.2  # 💡 Tiny pause to keep publishing stable over the tunnel
done
echo "✅ Messages published successfully!"

echo "----------------------------------------"
# Step 4: Wait and Observe Scale-Up
echo "➡️ Step 4: Holding queue open for 25 seconds..."
echo "👉 Check your side terminal now using 'kubectl get pods -w' to watch KEDA scale up!"
sleep 25

echo "----------------------------------------"
# Step 5: Automated Purge to Trigger Scale-Down
echo "➡️ Step 5: Automatically purging NATS stream to mimic completed work..."
if ! nats stream purge RESUMES --server="$NATS_SERVER" -f; then
    echo "❌ Warning: Stream purge command failed." >&2
else
    echo "✅ Stream wiped successfully! Watch KEDA cleanly scale your pods back down to 1."
fi

echo "----------------------------------------"
echo "🎉 Lifecycle test run finished!"