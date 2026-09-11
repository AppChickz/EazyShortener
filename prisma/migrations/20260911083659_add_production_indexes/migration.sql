-- CreateIndex
CREATE INDEX "api_tokens_user_id_created_at_idx" ON "api_tokens"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "click_events_link_id_referrer_host_idx" ON "click_events"("link_id", "referrer_host");

-- CreateIndex
CREATE INDEX "click_events_clicked_at_idx" ON "click_events"("clicked_at");

-- CreateIndex
CREATE INDEX "links_user_id_created_at_idx" ON "links"("user_id", "created_at");
