// app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { AppComponent } from './app.component';
import { CodeExecutorComponent } from './code-executor/code-executor.component';
import { WebsocketService } from './websocket.service';

@NgModule({
  declarations: [
    AppComponent,
    CodeExecutorComponent
  ],
  imports: [
    BrowserModule,
    FormsModule
  ],
  providers: [WebsocketService],
  bootstrap: [AppComponent]
})
export class AppModule { }
